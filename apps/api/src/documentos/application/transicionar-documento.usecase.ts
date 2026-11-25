import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ACTOR_SISTEMA, ActorDocumento, Documento, EstadoDocumento } from '../domain/documento';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import { TRANSACCION, TransaccionPort } from '../domain/ports/transaccion.port';
import { SolicitarPdfDocumentoUseCase } from './solicitar-pdf-documento.usecase';

@Injectable()
export class TransicionarDocumentoUseCase {
  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
    @Inject(TRANSACCION) private readonly transaccion: TransaccionPort,
    @Optional() private readonly solicitarPdf?: SolicitarPdfDocumentoUseCase,
  ) {}

  private readonly logger = new Logger(TransicionarDocumentoUseCase.name);

  /** Dos transiciones simultáneas del mismo documento se serializan (la fila queda bloqueada). */
  async ejecutar(
    id: string,
    nuevoEstado: EstadoDocumento,
    actor: ActorDocumento = ACTOR_SISTEMA,
    motivo?: string | null,
  ): Promise<Documento> {
    const documento = await this.transaccion.ejecutar(async (contexto) => {
      const documento = await this.repo.buscarPorId(id, contexto);
      if (!documento) {
        throw new NotFoundException(`Documento ${id} no encontrado`);
      }
      documento.transicionarA(nuevoEstado, actor, motivo);
      await this.repo.guardar(documento, contexto);
      return documento;
    });

    // Aprobar encola el PDF (GAF-54), ya con la aprobación confirmada. Si encolar falla, la aprobación
    // se mantiene y el error queda visible en el documento (`pdf.estado = ERROR`) para reintentar.
    if (nuevoEstado === 'APROBADO' && this.solicitarPdf) {
      try {
        await this.solicitarPdf.ejecutar(id);
      } catch (error) {
        this.logger.error(`Documento ${id} aprobado, pero su PDF no se pudo encolar: ${(error as Error).message}`);
      }
    }
    return documento;
  }
}
