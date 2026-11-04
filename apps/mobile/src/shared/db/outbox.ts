/**
 * GAFER Mobile — OutboxQueue (Offline-First)
 * Cola de operaciones durable respaldada por la tabla sync_outbox en SQLite (Guía Rev 2 §6.1).
 * Soporta también OutboxStorage para retrocompatibilidad con suites de pruebas unitarias.
 */

import {
  OperacionSync,
  LoteSyncRequest,
  LoteSyncResponse,
  LoteSyncResponseSchema,
} from '@gafer/contracts';
import { SqliteDatabasePort, obtenerBaseDeDatos } from './sqlite';

export interface OutboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemoryOutboxStorage implements OutboxStorage {
  private store = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export interface OpcionesEncolarOutbox {
  deviceId?: string;
  aggregateType?: string;
  aggregateSeq?: number;
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  baseVersion?: number;
}

export interface OutboxRecord {
  operacion: OperacionSync;
  intentos: number;
  sincronizado: boolean;
  ultimoError?: string;
  aggregateSeq?: number;
  priority?: string;
}

interface FilaSyncOutboxDb {
  operation_id: string;
  device_id: string;
  user_id: string;
  aggregate_type: string;
  aggregate_id: string;
  operation_type: string;
  base_version: number;
  payload_kind: string;
  changed_fields_json: string | null;
  payload_json: string;
  aggregate_seq: number;
  priority: string;
  depends_on_operation_id: string | null;
  created_at_local: string;
  attempt_count: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  status: string;
  last_error_code: string | null;
  last_error_message_sanitized: string | null;
}

export class OutboxQueue {
  private cola: OutboxRecord[] = [];
  private readonly storageKey = 'gafer_outbox_queue_v1';
  private db?: SqliteDatabasePort;
  private storage?: OutboxStorage;

  constructor(target?: SqliteDatabasePort | OutboxStorage) {
    if (target && 'execAsync' in target) {
      this.db = target;
    } else if (target && 'getItem' in target) {
      this.storage = target;
    } else {
      try {
        this.db = obtenerBaseDeDatos();
      } catch {
        // DB no inicializada aún, operará en memoria
      }
    }
  }

  /**
   * Carga las operaciones pendientes desde SQLite (o storage de fallback).
   */
  async inicializar(): Promise<void> {
    if (this.db) {
      const filas = await this.db.getAllAsync<FilaSyncOutboxDb>(
        `SELECT * FROM sync_outbox 
         WHERE status = 'PENDING'
         ORDER BY 
           CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END ASC,
           aggregate_seq ASC,
           created_at_local ASC;`,
      );

      this.cola = filas.map((fila) => {
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(fila.payload_json);
        } catch {
          payload = {};
        }

        return {
          operacion: {
            operationId: fila.operation_id,
            tipo: fila.operation_type as any,
            agregadoId: fila.aggregate_id,
            actorId: fila.user_id,
            clienteTimestamp: fila.created_at_local,
            payload,
          },
          intentos: fila.attempt_count,
          sincronizado: fila.status === 'SYNCED',
          ultimoError: fila.last_error_message_sanitized ?? undefined,
          aggregateSeq: fila.aggregate_seq,
          priority: fila.priority,
        };
      });
      return;
    }

    if (this.storage) {
      const raw = await this.storage.getItem(this.storageKey);
      if (raw) {
        try {
          this.cola = JSON.parse(raw);
        } catch {
          this.cola = [];
        }
      }
    }
  }

  private async persistir(): Promise<void> {
    if (this.storage) {
      await this.storage.setItem(this.storageKey, JSON.stringify(this.cola));
    }
  }

  /**
   * Encola una operación en la base de datos local SQLite bajo una transacción exclusiva.
   */
  async encolar(
    operacion: OperacionSync,
    opciones?: OpcionesEncolarOutbox,
  ): Promise<OutboxRecord> {
    const seq = opciones?.aggregateSeq ?? this.cola.length + 1;
    const prioridad = opciones?.priority ?? 'HIGH';
    const record: OutboxRecord = {
      operacion,
      intentos: 0,
      sincronizado: false,
      aggregateSeq: seq,
      priority: prioridad,
    };

    if (this.db) {
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(
          `INSERT OR REPLACE INTO sync_outbox (
            operation_id,
            device_id,
            user_id,
            aggregate_type,
            aggregate_id,
            operation_type,
            base_version,
            payload_kind,
            changed_fields_json,
            payload_json,
            aggregate_seq,
            priority,
            depends_on_operation_id,
            created_at_local,
            attempt_count,
            last_attempt_at,
            next_retry_at,
            status,
            last_error_code,
            last_error_message_sanitized
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            operacion.operationId,
            opciones?.deviceId ?? 'device-local-id',
            operacion.actorId,
            opciones?.aggregateType ?? 'INSPECCION',
            operacion.agregadoId,
            operacion.tipo,
            opciones?.baseVersion ?? 0,
            'FULL',
            null,
            JSON.stringify(operacion.payload),
            seq,
            prioridad,
            null,
            operacion.clienteTimestamp,
            0,
            null,
            null,
            'PENDING',
            null,
            null,
          ],
        );
      });
    }

    this.cola.push(record);
    await this.persistir();
    return record;
  }

  obtenerPendientes(): OutboxRecord[] {
    return this.cola.filter((op) => !op.sincronizado);
  }

  async marcarSincronizadas(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    for (const record of this.cola) {
      if (idSet.has(record.operacion.operationId)) {
        record.sincronizado = true;
      }
    }

    if (this.db && ids.length > 0) {
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        for (const id of ids) {
          await tx.runAsync(
            `UPDATE sync_outbox SET status = 'SYNCED' WHERE operation_id = ?;`,
            [id],
          );
        }
      });
    }

    await this.persistir();
  }

  async limpiarSincronizados(): Promise<void> {
    this.cola = this.cola.filter((op) => !op.sincronizado);

    if (this.db) {
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(`DELETE FROM sync_outbox WHERE status = 'SYNCED';`);
      });
    }

    await this.persistir();
  }

  async enviarLote(
    apiUrl: string,
    inspeccionId: string,
    fetchFn: typeof fetch = fetch,
  ): Promise<LoteSyncResponse | null> {
    const pendientes = this.obtenerPendientes().filter(
      (r) => r.operacion.agregadoId === inspeccionId,
    );
    if (pendientes.length === 0) return null;

    const loteRequest: LoteSyncRequest = {
      inspeccionId,
      operaciones: pendientes.map((p) => p.operacion),
    };

    try {
      const response = await fetchFn(
        `${apiUrl}/api/operaciones/inspecciones/${inspeccionId}/sincronizar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loteRequest),
        },
      );

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        const ahora = new Date().toISOString();
        for (const item of pendientes) {
          item.intentos += 1;
          item.ultimoError = errorMsg;
        }

        if (this.db) {
          await this.db.withExclusiveTransactionAsync(async (tx) => {
            for (const item of pendientes) {
              await tx.runAsync(
                `UPDATE sync_outbox 
                 SET attempt_count = attempt_count + 1,
                     last_attempt_at = ?,
                     last_error_message_sanitized = ?
                 WHERE operation_id = ?;`,
                [ahora, errorMsg, item.operacion.operationId],
              );
            }
          });
        }

        await this.persistir();
        return null;
      }

      const resBody = LoteSyncResponseSchema.parse(await response.json());
      const exitosos = [...resBody.procesadas, ...resBody.omitidasIdempotentes];
      await this.marcarSincronizadas(exitosos);
      await this.limpiarSincronizados();
      return resBody;
    } catch (err: any) {
      const errorMsg = err.message || 'Error de red';
      const ahora = new Date().toISOString();
      for (const item of pendientes) {
        item.intentos += 1;
        item.ultimoError = errorMsg;
      }

      if (this.db) {
        await this.db.withExclusiveTransactionAsync(async (tx) => {
          for (const item of pendientes) {
            await tx.runAsync(
              `UPDATE sync_outbox 
               SET attempt_count = attempt_count + 1,
                   last_attempt_at = ?,
                   last_error_message_sanitized = ?
               WHERE operation_id = ?;`,
              [ahora, errorMsg, item.operacion.operationId],
            );
          }
        });
      }

      await this.persistir();
      return null;
    }
  }
}
