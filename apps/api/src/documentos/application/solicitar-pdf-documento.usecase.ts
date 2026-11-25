import { ConflictException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import { COLA_PDF, ColaPdfPort } from '../domain/ports/pdf.ports';
import { TRANSACCION, TransaccionPort } from '../domain/ports/transaccion.port';

@Injectable()
export class SolicitarPdfDocumentoUseCase {
  private readonly logger = new Logger(SolicitarPdfDocumentoUseCase.name);

  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
    @Inject(TRANSACCION) private readonly transaccion: TransaccionPort,
    @Inject(COLA_PDF) private readonly cola: ColaPdfPort,
  ) {}

  /**
   * Marca el PDF como PENDIENTE y encola el trabajo; no renderiza nada. Primero se guarda el estado y
   * recién después se encola: así el worker nunca recibe un trabajo cuyo estado aún no se confirmó.
   * Si la cola falla, el documento queda con ERROR visible (reintentable) y el error se propaga.
   */
  async ejecutar(id: string): Promise<void> {
    await this.transaccion.ejecutar(async (contexto) => {
      const documento = await this.repo.buscarPorId(id, contexto);
      if (!documento) throw new NotFoundException(`Documento ${id} no encontrado`);
      try {
        documento.solicitarPdf();
      } catch (error) {
        throw new ConflictException((error as Error).message);
      }
      await this.repo.guardar(documento, contexto);
    });

    try {
      await this.cola.encolar(id);
    } catch (error) {
      const motivo = `No se pudo encolar la generación del PDF: ${(error as Error).message}`;
      this.logger.error(`${motivo} (documento ${id})`);
      await this.transaccion.ejecutar(async (contexto) => {
        const documento = await this.repo.buscarPorId(id, contexto);
        if (!documento) return;
        documento.marcarPdfFallido(motivo);
        await this.repo.guardar(documento, contexto);
      });
      throw new ServiceUnavailableException(motivo);
    }
  }
}
