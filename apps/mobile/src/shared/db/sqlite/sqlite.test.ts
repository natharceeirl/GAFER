import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
  obtenerBaseDeDatos,
  MemorySqliteAdapter,
  ExpoSqliteAdapter,
  ejecutarMigraciones,
  obtenerVersionEsquema,
  ESQUEMA_VERSION_ACTUAL,
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

  it('migra de v1 a v2 agregando usuario_id sin perder borradores existentes', async () => {
    const { MIGRACIONES } = await import('./migrations');
    const adapter = new MemorySqliteAdapter();
    await MIGRACIONES[0].ejecutar(adapter);
    await adapter.execAsync('PRAGMA user_version = 1;');
    await adapter.runAsync(
      `INSERT INTO borradores_inspeccion (servicio_id, observaciones, actualizado_en) VALUES (?, ?, ?);`,
      ['srv-v1', 'Notas previas', new Date().toISOString()],
    );

    const version = await ejecutarMigraciones(adapter);

    expect(version).toBe(2);
    const fila = await adapter.getFirstAsync<{ observaciones: string; usuario_id: string | null }>(
      'SELECT observaciones, usuario_id FROM borradores_inspeccion WHERE servicio_id = ?;',
      ['srv-v1'],
    );
    expect(fila?.observaciones).toBe('Notas previas');
    expect(fila?.usuario_id).toBeNull();
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
