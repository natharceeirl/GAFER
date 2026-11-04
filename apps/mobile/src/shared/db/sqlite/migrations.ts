/**
 * GAFER Mobile — Migraciones SQLite Versionadas (PRAGMA user_version)
 * Cumple con la Guía de Arquitectura Offline-First Rev 2 (Secciones 5.5, 6 y 17).
 */

import { SqliteDatabasePort } from './database-port';

export const ESQUEMA_VERSION_ACTUAL = 1;

export interface Migracion {
  version: number;
  descripcion: string;
  ejecutar: (db: SqliteDatabasePort) => Promise<void>;
}

export const MIGRACIONES: Migracion[] = [
  {
    version: 1,
    descripcion: 'Esquema base v1: metadata, borradores, sync_outbox, sync_conflicts y files_local',
    ejecutar: async (db: SqliteDatabasePort) => {
      // 1. Tabla sync_metadata (Sección 6.4)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 2. Tabla borradores_inspeccion (Proyección local durable de inspección en curso)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS borradores_inspeccion (
          servicio_id TEXT PRIMARY KEY,
          cliente_razon_social TEXT,
          sede_nombre TEXT,
          numero_orden TEXT,
          servicio_tipo TEXT,
          observaciones TEXT NOT NULL DEFAULT '',
          datos_json TEXT,
          actualizado_en TEXT NOT NULL,
          server_version INTEGER NOT NULL DEFAULT 0,
          sync_status TEXT NOT NULL DEFAULT 'PENDING_SYNC'
        );
      `);

      // 3. Tabla sync_outbox (Sección 6.1 — 18 campos contractuales de sincronización)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_outbox (
          operation_id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          aggregate_type TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          base_version INTEGER NOT NULL DEFAULT 0,
          payload_kind TEXT NOT NULL DEFAULT 'FULL',
          changed_fields_json TEXT,
          payload_json TEXT NOT NULL,
          aggregate_seq INTEGER NOT NULL DEFAULT 1,
          priority TEXT NOT NULL DEFAULT 'HIGH',
          depends_on_operation_id TEXT,
          created_at_local TEXT NOT NULL,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_attempt_at TEXT,
          next_retry_at TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          last_error_code TEXT,
          last_error_message_sanitized TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_status_priority_seq 
          ON sync_outbox(status, priority, aggregate_seq);

        CREATE INDEX IF NOT EXISTS idx_outbox_aggregate 
          ON sync_outbox(aggregate_type, aggregate_id, aggregate_seq);
      `);

      // 4. Tabla sync_conflicts (Sección 6.2 — registro durable de discrepancias)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_conflicts (
          conflict_id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL,
          aggregate_type TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          base_snapshot_json TEXT,
          local_snapshot_json TEXT,
          server_snapshot_json TEXT,
          conflict_fields_json TEXT,
          server_version INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          resolved_by TEXT,
          resolved_at TEXT,
          resolution_note TEXT
        );
      `);

      // 5. Tabla files_local (Sección 6.3 — rutas relativas para almacenamiento privado)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS files_local (
          file_id TEXT PRIMARY KEY,
          inspection_id TEXT NOT NULL,
          file_type TEXT NOT NULL,
          local_path_relative TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0,
          remote_file_id TEXT,
          sha256 TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          upload_status TEXT NOT NULL DEFAULT 'PENDING',
          retention_state TEXT NOT NULL DEFAULT 'PENDING',
          pdf_selection_status TEXT NOT NULL DEFAULT 'UNKNOWN',
          captured_at TEXT NOT NULL,
          uploaded_at TEXT,
          local_purge_after TEXT,
          purged_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_files_inspection 
          ON files_local(inspection_id, upload_status);
      `);
    },
  },
];

/**
 * Aplica las configuraciones de durabilidad PRAGMA obligatorias (Guía Rev 2 §5.5).
 */
export async function configurarPragmas(db: SqliteDatabasePort): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
}

/**
 * Obtiene la versión actual del esquema registrada en PRAGMA user_version.
 */
export async function obtenerVersionEsquema(db: SqliteDatabasePort): Promise<number> {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return fila?.user_version ?? 0;
}

/**
 * Ejecuta el migrador secuencial y actualiza PRAGMA user_version atómicamente.
 */
export async function ejecutarMigraciones(db: SqliteDatabasePort): Promise<number> {
  await configurarPragmas(db);
  const versionActual = await obtenerVersionEsquema(db);

  for (const migracion of MIGRACIONES) {
    if (migracion.version > versionActual) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await migracion.ejecutar(tx);
        await tx.execAsync(`PRAGMA user_version = ${migracion.version};`);
      });
    }
  }

  return obtenerVersionEsquema(db);
}
