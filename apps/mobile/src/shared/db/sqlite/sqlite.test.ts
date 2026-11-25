import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
  obtenerBaseDeDatos,
  MemorySqliteAdapter,
  ExpoSqliteAdapter,
  ejecutarMigraciones,
  obtenerVersionEsquema,
  ESQUEMA_VERSION_ACTUAL,
  SqliteDatabasePort,
} from './index';

describe('SQLite Port & Migraciones', () => {
  beforeEach(async () => {
    await cerrarBaseDeDatos();
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  it('ejecuta migraciones v1 correctamente en MemorySqliteAdapter', async () => {
    const memoryAdapter = new MemorySqliteAdapter();
    const versionFinal = await ejecutarMigraciones(memoryAdapter);

    expect(versionFinal).toBe(ESQUEMA_VERSION_ACTUAL);

    // Verificar existencia de tablas requeridas por la Guía Rev 2
    const metadata = await memoryAdapter.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_metadata';",
    );
    expect(metadata.length).toBe(1);

    const outbox = await memoryAdapter.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_outbox';",
    );
    expect(outbox.length).toBe(1);

    const borradores = await memoryAdapter.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='borradores_inspeccion';",
    );
    expect(borradores.length).toBe(1);

    const conflicts = await memoryAdapter.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_conflicts';",
    );
    expect(conflicts.length).toBe(1);

    const files = await memoryAdapter.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='files_local';",
    );
    expect(files.length).toBe(1);
  });

  it('soporta transacciones exclusivas con rollback ante error', async () => {
    const adapter = new MemorySqliteAdapter();
    await ejecutarMigraciones(adapter);

    await adapter.runAsync(
      'INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?);',
      ['test_key', 'initial_value', new Date().toISOString()],
    );

    // Transacción fallida
    await expect(
      adapter.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(
          'UPDATE sync_metadata SET value = ? WHERE key = ?;',
          ['updated_value', 'test_key'],
        );
        throw new Error('Error simulado para forzar rollback');
      }),
    ).rejects.toThrow('Error simulado para forzar rollback');

    // Debe conservar el valor inicial debido al rollback
    const fila = await adapter.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?;',
      ['test_key'],
    );
    expect(fila?.value).toBe('initial_value');
  });

  it('dos transacciones lanzadas a la vez no se intercalan ni fallan', async () => {
    const adapter = new MemorySqliteAdapter();
    await ejecutarMigraciones(adapter);
    const ahora = new Date().toISOString();

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        adapter.withExclusiveTransactionAsync(async (tx) => {
          await tx.runAsync('INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?);', [
            `k${i}`,
            String(i),
            ahora,
          ]);
          // Cede el turno a mitad de la transacción: otra no debe colarse aquí.
          await new Promise((r) => setTimeout(r, 1));
          await tx.runAsync('UPDATE sync_metadata SET value = value || ? WHERE key = ?;', [
            '-ok',
            `k${i}`,
          ]);
        }),
      ),
    );

    const filas = await adapter.getAllAsync<{ value: string }>('SELECT value FROM sync_metadata;');
    expect(filas).toHaveLength(10);
    expect(filas.every((f) => f.value.endsWith('-ok'))).toBe(true);
  });

  it('migra de v1 a v3 agregando usuario_id y PK compuesta sin perder borradores existentes', async () => {
    const { MIGRACIONES } = await import('./migrations');
    const adapter = new MemorySqliteAdapter();
    await MIGRACIONES[0].ejecutar(adapter);
    await adapter.execAsync('PRAGMA user_version = 1;');
    await adapter.runAsync(
      `INSERT INTO borradores_inspeccion (servicio_id, observaciones, actualizado_en) VALUES (?, ?, ?);`,
      ['srv-v1', 'Notas previas', new Date().toISOString()],
    );

    const version = await ejecutarMigraciones(adapter);

    expect(version).toBe(ESQUEMA_VERSION_ACTUAL);
    const fila = await adapter.getFirstAsync<{ observaciones: string; usuario_id: string }>(
      'SELECT observaciones, usuario_id FROM borradores_inspeccion WHERE servicio_id = ?;',
      ['srv-v1'],
    );
    expect(fila?.observaciones).toBe('Notas previas');
    expect(fila?.usuario_id).toBe('');

    // En v3 dos técnicos pueden mantener borradores independientes para el mismo servicio_id.
    const ahora = new Date().toISOString();
    await adapter.runAsync(
      `INSERT INTO borradores_inspeccion (servicio_id, usuario_id, observaciones, actualizado_en) VALUES (?, ?, ?, ?);`,
      ['srv-v1', 'tec-A', 'Notas A', ahora],
    );
    await adapter.runAsync(
      `INSERT INTO borradores_inspeccion (servicio_id, usuario_id, observaciones, actualizado_en) VALUES (?, ?, ?, ?);`,
      ['srv-v1', 'tec-B', 'Notas B', ahora],
    );

    const filas = await adapter.getAllAsync<{ usuario_id: string; observaciones: string }>(
      'SELECT usuario_id, observaciones FROM borradores_inspeccion WHERE servicio_id = ? ORDER BY usuario_id ASC;',
      ['srv-v1'],
    );
    expect(filas).toEqual([
      { usuario_id: '', observaciones: 'Notas previas' },
      { usuario_id: 'tec-A', observaciones: 'Notas A' },
      { usuario_id: 'tec-B', observaciones: 'Notas B' },
    ]);
  });

  it('carga expo-sqlite con literal estático compatible con Metro (F1)', () => {
    const contenido = readFileSync(join(__dirname, 'index.ts'), 'utf8');
    expect(contenido).toMatch(/(?:require|import)\(\s*['"]expo-sqlite['"]\s*\)/);
    expect(contenido).not.toMatch(/import\(\s*\/\*[^*]*\*\/\s*[a-zA-Z_$]/);
  });

  it('cierra la conexión si fallan las migraciones y permite reintentar sin fuga (F4)', async () => {
    const closeAsync = vi.fn(async () => undefined);
    const puertoFallido: SqliteDatabasePort = {
      execAsync: vi.fn(async () => {
        throw new Error('Error simulado en PRAGMA/migración');
      }),
      runAsync: vi.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
      getAllAsync: vi.fn(async () => []),
      getFirstAsync: vi.fn(async () => null),
      withExclusiveTransactionAsync: vi.fn(async (action) => action(puertoFallido)),
      closeAsync,
    };

    await expect(inicializarBaseDeDatos(puertoFallido)).rejects.toThrow(
      'Error simulado en PRAGMA/migración',
    );
    expect(closeAsync).toHaveBeenCalledTimes(1);
    expect(() => obtenerBaseDeDatos()).toThrow(/no ha sido inicializada/);

    // Reintentar después de un fallo debe inicializar correctamente
    const db = await inicializarBaseDeDatos();
    expect(obtenerBaseDeDatos()).toBe(db);
  });

  it('preserva el error original de migración aunque closeAsync también falle (F4)', async () => {
    const closeAsync = vi.fn(async () => {
      throw new Error('Fallo secundario al cerrar');
    });
    const puertoFallido: SqliteDatabasePort = {
      execAsync: vi.fn(async () => {
        throw new Error('Error principal de migración');
      }),
      runAsync: vi.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
      getAllAsync: vi.fn(async () => []),
      getFirstAsync: vi.fn(async () => null),
      withExclusiveTransactionAsync: vi.fn(async (action) => action(puertoFallido)),
      closeAsync,
    };

    await expect(inicializarBaseDeDatos(puertoFallido)).rejects.toThrow(
      'Error principal de migración',
    );
    expect(closeAsync).toHaveBeenCalledTimes(1);
  });

  describe('ExpoSqliteAdapter', () => {
    function crearExpoFalso() {
      const sentencias: string[] = [];
      const fake = {
        execAsync: vi.fn(async (sql: string) => {
          sentencias.push(sql.trim());
        }),
        runAsync: vi.fn(async (sql: string) => {
          sentencias.push(sql.trim());
          await new Promise((r) => setTimeout(r, 1));
          return { changes: 1, lastInsertRowId: 1 };
        }),
        getAllAsync: vi.fn(async () => []),
        getFirstAsync: vi.fn(async () => null),
        closeAsync: vi.fn(async () => undefined),
        withExclusiveTransactionAsync: vi.fn(),
      };
      return { fake, sentencias };
    }

    it('usa la misma conexión (con sus PRAGMA) y no la conexión aparte de expo-sqlite', async () => {
      const { fake, sentencias } = crearExpoFalso();
      const adapter = new ExpoSqliteAdapter(fake);

      await adapter.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('UPDATE a SET b = 1;');
      });

      expect(fake.withExclusiveTransactionAsync).not.toHaveBeenCalled();
      expect(sentencias).toEqual(['BEGIN IMMEDIATE;', 'UPDATE a SET b = 1;', 'COMMIT;']);
    });

    it('serializa transacciones concurrentes y escrituras sueltas', async () => {
      const { fake, sentencias } = crearExpoFalso();
      const adapter = new ExpoSqliteAdapter(fake);

      await Promise.all([
        adapter.withExclusiveTransactionAsync(async (tx) => {
          await tx.runAsync('T1-a');
          await tx.runAsync('T1-b');
        }),
        adapter.runAsync('SUELTA'),
        adapter.withExclusiveTransactionAsync(async (tx) => {
          await tx.runAsync('T2-a');
        }),
      ]);

      expect(sentencias).toEqual([
        'BEGIN IMMEDIATE;',
        'T1-a',
        'T1-b',
        'COMMIT;',
        'SUELTA',
        'BEGIN IMMEDIATE;',
        'T2-a',
        'COMMIT;',
      ]);
    });

    it('hace ROLLBACK y propaga el error; la cola sigue funcionando después', async () => {
      const { fake, sentencias } = crearExpoFalso();
      const adapter = new ExpoSqliteAdapter(fake);

      await expect(
        adapter.withExclusiveTransactionAsync(async () => {
          throw new Error('falla');
        }),
      ).rejects.toThrow('falla');
      await adapter.runAsync('DESPUES');

      expect(sentencias).toEqual(['BEGIN IMMEDIATE;', 'ROLLBACK;', 'DESPUES']);
    });
  });

  it('inicializa singleton global mediante inicializarBaseDeDatos', async () => {
    const db = await inicializarBaseDeDatos();
    expect(db).toBeDefined();
    expect(obtenerBaseDeDatos()).toBe(db);

    const version = await obtenerVersionEsquema(db);
    expect(version).toBe(ESQUEMA_VERSION_ACTUAL);
  });
});
