import { Injectable, Logger } from '@nestjs/common';
import { TransicionarDocumentoUseCase } from '@gafer/api';

/**
 * Stub del consumidor de la cola de jobs (sección 9 de la especificación).
 * En producción escucha el evento DocumentoAprobado emitido por el módulo
 * `documentos` (apps/api) vía la cola (ver diagrama de arquitectura backend)
 * y genera el PDF de forma asíncrona sin bloquear el flujo de campo.
 *
 * Reutiliza el mismo código de aplicación de apps/api (importado como
 * paquete del workspace) en lugar de duplicar la lógica de negocio.
 */
@Injectable()
export class GenerarPdfConsumer {
  private readonly logger = new Logger(GenerarPdfConsumer.name);

  constructor(private readonly transicionarDocumento: TransicionarDocumentoUseCase) {}

  async manejarDocumentoAprobado(documentoId: string): Promise<void> {
    this.logger.log(`Generaría el PDF para el documento ${documentoId} ahora`);
    // TODO: implementar PDFGeneratorPort + StoragePort reales (sección 9)
    // antes de marcar el documento como ENVIADO.
    await this.transicionarDocumento.ejecutar(documentoId, 'ENVIADO');
  }
}
