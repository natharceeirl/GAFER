import {
  OperacionSync,
  LoteSyncRequest,
  LoteSyncResponse,
} from '@gafer/contracts';

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

export interface OutboxRecord {
  operacion: OperacionSync;
  intentos: number;
  sincronizado: boolean;
  ultimoError?: string;
}

export class OutboxQueue {
  private cola: OutboxRecord[] = [];
  private readonly storageKey = 'gafer_outbox_queue_v1';

  constructor(private readonly storage?: OutboxStorage) {}

  async inicializar(): Promise<void> {
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

  async persistir(): Promise<void> {
    if (this.storage) {
      await this.storage.setItem(this.storageKey, JSON.stringify(this.cola));
    }
  }

  async encolar(operacion: OperacionSync): Promise<OutboxRecord> {
    const record: OutboxRecord = {
      operacion,
      intentos: 0,
      sincronizado: false,
    };
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
    await this.persistir();
  }

  async limpiarSincronizados(): Promise<void> {
    this.cola = this.cola.filter((op) => !op.sincronizado);
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
        for (const item of pendientes) {
          item.intentos += 1;
          item.ultimoError = `HTTP ${response.status}: ${response.statusText}`;
        }
        await this.persistir();
        return null;
      }

      const resBody: LoteSyncResponse = await response.json();
      const exitosos = [...resBody.procesadas, ...resBody.omitidasIdempotentes];
      await this.marcarSincronizadas(exitosos);
      await this.limpiarSincronizados();
      return resBody;
    } catch (err: any) {
      for (const item of pendientes) {
        item.intentos += 1;
        item.ultimoError = err.message;
      }
      await this.persistir();
      return null;
    }
  }
}
