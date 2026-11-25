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

/** Fallo al leer o escribir el almacenamiento local, distinto de un error de red o del servidor. */
export class ErrorPersistenciaLocal extends Error {
  constructor(mensaje: string, causa?: unknown) {
    super(mensaje, { cause: causa });
    this.name = 'ErrorPersistenciaLocal';
  }
}

export class OutboxQueue {
  private cola: OutboxRecord[] = [];
  private readonly contadoresEnMemoria = new Map<string, number>();
  private readonly storageKey = 'gafer_outbox_queue_v1';
  private db?: SqliteDatabasePort;
  private storage?: OutboxStorage;

  constructor(target?: SqliteDatabasePort | OutboxStorage) {
    if (target && 'execAsync' in target) {
      this.db = target;
    } else if (target && 'getItem' in target) {
      this.storage = target;
    } else {
      // Sin destino explícito exigimos la base real: degradar a memoria perdería operaciones al cerrar la app.
      // El modo sin SQLite solo existe pasando un OutboxStorage de forma explícita.
      try {
        this.db = obtenerBaseDeDatos();
      } catch (causa) {
        throw new Error(
          'OutboxQueue requiere la base de datos SQLite inicializada. Llama primero a inicializarBaseDeDatos() o pasa un OutboxStorage explícito.',
          { cause: causa },
        );
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
   * Siguiente número de secuencia del agregado, calculado dentro de la transacción del INSERT.
   *
   * La secuencia se cuenta por `aggregate_id` (sin importar el `aggregate_type`), porque
   * el lote que se envía al servidor agrupa por `agregadoId`: así las operaciones de
   * distinto tipo sobre la misma inspección conservan el orden en que se registraron.
   *
   * Usa el mayor entre el contador persistido en `sync_metadata` y el MAX(aggregate_seq)
   * de la tabla, así que nunca retrocede: ni al limpiar las operaciones sincronizadas
   * ni al reiniciar la app. Un `aggregateSeq` explícito se respeta y adelanta el contador.
   */
  private async reservarSecuencia(
    tx: SqliteDatabasePort,
    aggregateId: string,
    seqExplicita?: number,
  ): Promise<number> {
    const clave = `outbox_seq:${aggregateId}`;
    const contador = await tx.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = ?;`,
      [clave],
    );
    const maximo = await tx.getFirstAsync<{ max_seq: number | null }>(
      `SELECT MAX(aggregate_seq) AS max_seq FROM sync_outbox WHERE aggregate_id = ?;`,
      [aggregateId],
    );

    const ultima = Math.max(Number(contador?.value ?? 0), Number(maximo?.max_seq ?? 0));
    const seq = seqExplicita ?? ultima + 1;

    await tx.runAsync(
      `INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [clave, String(Math.max(seq, ultima)), new Date().toISOString()],
    );
    return seq;
  }

  /** Versión en memoria de reservarSecuencia para el modo OutboxStorage (sin SQLite). */
  private siguienteSecuenciaEnMemoria(aggregateId: string): number {
    const usadas = this.cola
      .filter((r) => r.operacion.agregadoId === aggregateId)
      .map((r) => r.aggregateSeq ?? 0);
    const ultima = Math.max(this.contadoresEnMemoria.get(aggregateId) ?? 0, 0, ...usadas);
    this.contadoresEnMemoria.set(aggregateId, ultima + 1);
    return ultima + 1;
  }

  /**
   * Encola una operación en la base de datos local SQLite bajo una transacción exclusiva.
   * Es idempotente por `operationId`: encolar dos veces la misma operación no la duplica
   * ni le cambia la secuencia o el estado.
   */
  async encolar(
    operacion: OperacionSync,
    opciones?: OpcionesEncolarOutbox,
  ): Promise<OutboxRecord> {
    const enMemoria = this.cola.find((r) => r.operacion.operationId === operacion.operationId);
    if (enMemoria) {
      return enMemoria;
    }

    const prioridad = opciones?.priority ?? 'HIGH';
    const aggregateType = opciones?.aggregateType ?? 'INSPECCION';
    const record: OutboxRecord = {
      operacion,
      intentos: 0,
      sincronizado: false,
      aggregateSeq: undefined,
      priority: prioridad,
    };

    if (this.db) {
      const existente = await this.db.withExclusiveTransactionAsync(async (tx) => {
        const previa = await tx.getFirstAsync<{ aggregate_seq: number; status: string }>(
          `SELECT aggregate_seq, status FROM sync_outbox WHERE operation_id = ?;`,
          [operacion.operationId],
        );
        if (previa) {
          return previa;
        }

        const seq = await this.reservarSecuencia(
          tx,
          operacion.agregadoId,
          opciones?.aggregateSeq,
        );
        record.aggregateSeq = seq;

        await tx.runAsync(
          `INSERT INTO sync_outbox (
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
            aggregateType,
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
        return null;
      });

      if (existente) {
        // Ya estaba en disco (por ejemplo, otra instancia de la cola la encoló).
        return {
          ...record,
          aggregateSeq: existente.aggregate_seq,
          sincronizado: existente.status === 'SYNCED',
        };
      }
    } else {
      record.aggregateSeq = opciones?.aggregateSeq ?? this.siguienteSecuenciaEnMemoria(operacion.agregadoId);
    }

    this.cola.push(record);
    await this.persistir();
    return record;
  }

  obtenerPendientes(): OutboxRecord[] {
    return this.cola.filter((op) => !op.sincronizado);
  }

  async marcarSincronizadas(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    if (this.db) {
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        for (const id of ids) {
          await tx.runAsync(
            `UPDATE sync_outbox SET status = 'SYNCED' WHERE operation_id = ?;`,
            [id],
          );
        }
      });
    }

    const idSet = new Set(ids);
    const siguienteCola = this.cola.map((record) =>
      idSet.has(record.operacion.operationId) ? { ...record, sincronizado: true } : record,
    );

    if (this.storage) {
      await this.storage.setItem(this.storageKey, JSON.stringify(siguienteCola));
    }

    this.cola = siguienteCola;
  }

  async limpiarSincronizados(): Promise<void> {
    if (this.db) {
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(`DELETE FROM sync_outbox WHERE status = 'SYNCED';`);
      });
    }

    const siguienteCola = this.cola.filter((op) => !op.sincronizado);

    if (this.storage) {
      await this.storage.setItem(this.storageKey, JSON.stringify(siguienteCola));
    }

    this.cola = siguienteCola;
  }

  async enviarLote(
    apiUrl: string,
    inspeccionId: string,
    fetchFn: typeof fetch = fetch,
  ): Promise<LoteSyncResponse | null> {
    // Dentro de una inspección el orden lo da la secuencia, no la prioridad.
    const pendientes = this.obtenerPendientes()
      .filter((r) => r.operacion.agregadoId === inspeccionId)
      .sort((a, b) => (a.aggregateSeq ?? 0) - (b.aggregateSeq ?? 0));
    if (pendientes.length === 0) return null;

    const loteRequest: LoteSyncRequest = {
      inspeccionId,
      operaciones: pendientes.map((p) => p.operacion),
    };

    let resBody: LoteSyncResponse;
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
        await this.registrarIntentoFallido(pendientes, `HTTP ${response.status}: ${response.statusText}`);
        return null;
      }

      resBody = LoteSyncResponseSchema.parse(await response.json());
    } catch (err) {
      if (err instanceof ErrorPersistenciaLocal) throw err;
      await this.registrarIntentoFallido(
        pendientes,
        err instanceof Error && err.message ? err.message : 'Error de red',
      );
      return null;
    }

    // El servidor ya aceptó el lote: de aquí en adelante un fallo es local y no cuenta como intento fallido.
    try {
      const exitosos = [...resBody.procesadas, ...resBody.omitidasIdempotentes];
      await this.marcarSincronizadas(exitosos);
      await this.limpiarSincronizados();
    } catch (causa) {
      throw new ErrorPersistenciaLocal(
        'El servidor aceptó el lote, pero no se pudo guardar el resultado en la base local. Las operaciones no se contaron como intento fallido.',
        causa,
      );
    }
    return resBody;
  }

  /**
   * Registra un intento fallido (red o servidor). Escribe primero en SQLite y solo después
   * actualiza la memoria, para que ambas queden consistentes si la escritura falla.
   */
  private async registrarIntentoFallido(pendientes: OutboxRecord[], errorMsg: string): Promise<void> {
    const ahora = new Date().toISOString();
    const siguientes = pendientes.map((item) => ({
      item,
      intentos: item.intentos + 1,
    }));

    try {
      if (this.db) {
        await this.db.withExclusiveTransactionAsync(async (tx) => {
          for (const { item } of siguientes) {
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
      if (this.storage) {
        const copia = this.cola.map((r) => {
          const s = siguientes.find((x) => x.item === r);
          return s ? { ...r, intentos: s.intentos, ultimoError: errorMsg } : r;
        });
        await this.storage.setItem(this.storageKey, JSON.stringify(copia));
      }
    } catch (causa) {
      throw new ErrorPersistenciaLocal(
        `No se pudo registrar el intento fallido en el almacenamiento local (error original: ${errorMsg}).`,
        causa,
      );
    }

    for (const { item, intentos } of siguientes) {
      item.intentos = intentos;
      item.ultimoError = errorMsg;
    }
  }
}
