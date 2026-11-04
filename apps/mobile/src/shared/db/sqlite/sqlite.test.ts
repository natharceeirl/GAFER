import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
  obtenerBaseDeDatos,
  MemorySqliteAdapter,
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

  it('inicializa singleton global mediante inicializarBaseDeDatos', async () => {
    const db = await inicializarBaseDeDatos();
    expect(db).toBeDefined();
    expect(obtenerBaseDeDatos()).toBe(db);

    const version = await obtenerVersionEsquema(db);
    expect(version).toBe(ESQUEMA_VERSION_ACTUAL);
  });
});
