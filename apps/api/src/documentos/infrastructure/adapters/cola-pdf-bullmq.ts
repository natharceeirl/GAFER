import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConnectionOptions, JobsOptions, Queue } from 'bullmq';
import { COLA_GENERAR_PDF, ColaPdfPort, TrabajoGenerarPdf } from '../../domain/ports/pdf.ports';

/** Opciones de conexión a Redis, compartidas con el worker (`REDIS_URL`, por defecto el Redis local). */
export function conexionRedis(url = process.env.REDIS_URL ?? 'redis://localhost:6379'): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    tls: u.protocol === 'rediss:' ? {} : undefined,
  };
}

/** Tres intentos con espera creciente: un MinIO o una base momentáneamente caídos no pierden el PDF. */
export const OPCIONES_TRABAJO_PDF: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

/** Productor de la cola de Redis. La conexión se abre en el primer uso: arrancar el servidor no exige Redis. */
@Injectable()
export class ColaPdfBullmq implements ColaPdfPort, OnModuleDestroy {
  private cola: Queue<TrabajoGenerarPdf> | null = null;

  private get tiempoMaximoMs(): number {
    return Number(process.env.REDIS_ENCOLAR_TIEMPO_MS ?? 5_000);
  }

  async encolar(documentoId: string): Promise<void> {
    const cola = this.abrir();
    let temporizador: NodeJS.Timeout | undefined;
    try {
      // Con Redis caído BullMQ reintenta conectar sin rendirse: sin este límite la petición HTTP quedaría colgada.
      await Promise.race([
        cola.add('generar', { documentoId }),
        new Promise<never>((_, rechazar) => {
          temporizador = setTimeout(
            () => rechazar(new Error(`Redis no respondió en ${this.tiempoMaximoMs} ms`)),
            this.tiempoMaximoMs,
          );
        }),
      ]);
    } catch (error) {
      // Se descarta la conexión rota: el próximo intento abre una nueva.
      this.cola = null;
      void cola.close().catch(() => undefined);
      throw error;
    } finally {
      clearTimeout(temporizador);
    }
  }

  private abrir(): Queue<TrabajoGenerarPdf> {
    this.cola ??= new Queue<TrabajoGenerarPdf>(COLA_GENERAR_PDF, {
      connection: { ...conexionRedis(), connectTimeout: 3_000, maxRetriesPerRequest: null },
      defaultJobOptions: OPCIONES_TRABAJO_PDF,
    });
    // Sin este oyente un Redis caído sería una excepción sin capturar del proceso.
    this.cola.on('error', () => undefined);
    return this.cola;
  }

  async onModuleDestroy(): Promise<void> {
    await this.cola?.close();
  }
}
