import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import {
  COLA_GENERAR_PDF,
  conexionRedis,
  GenerarPdfDocumentoUseCase,
  TrabajoGenerarPdf,
} from '@gafer/api';

/**
 * Consumidor de la cola `generar-pdf` (sección 9 de la especificación). El servidor HTTP solo encola;
 * aquí se renderiza y se guarda el PDF sin frenar el flujo de campo.
 *
 * La lógica vive en `GenerarPdfDocumentoUseCase` (apps/api), compartida como paquete del workspace.
 * Este proceso solo conecta la cola con ese caso de uso. Un fallo se propaga: el caso de uso ya dejó
 * el documento en ERROR con el motivo y la cola reintenta con espera creciente (ver OPCIONES_TRABAJO_PDF).
 */
@Injectable()
export class GenerarPdfConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(GenerarPdfConsumer.name);
  private worker: Worker<TrabajoGenerarPdf> | null = null;

  constructor(private readonly generar: GenerarPdfDocumentoUseCase) {}

  async procesar(trabajo: TrabajoGenerarPdf): Promise<void> {
    await this.generar.ejecutar(trabajo.documentoId);
    this.logger.log(`PDF del documento ${trabajo.documentoId} listo`);
  }

  /** Empieza a escuchar la cola de Redis (`REDIS_URL`). */
  iniciar(concurrencia = Number(process.env.WORKER_PDF_CONCURRENCY ?? 2)): void {
    if (this.worker) return;
    this.worker = new Worker<TrabajoGenerarPdf>(COLA_GENERAR_PDF, (job: Job<TrabajoGenerarPdf>) => this.procesar(job.data), {
      connection: conexionRedis(),
      concurrency: concurrencia,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Falló el PDF del documento ${job?.data.documentoId} (intento ${job?.attemptsMade}/${job?.opts.attempts}): ${error.message}`),
    );
    this.worker.on('error', (error) => this.logger.error(`Error del worker de PDF: ${error.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.worker = null;
  }
}
