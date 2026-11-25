import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ACTOR_SISTEMA, ActorDocumento, Documento, EstadoDocumento } from '../domain/documento';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import { TRANSACCION, TransaccionPort } from '../domain/ports/transaccion.port';

@Injectable()
export class TransicionarDocumentoUseCase {
  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
    @Inject(TRANSACCION) private readonly transaccion: TransaccionPort,
  ) {}

  /** Dos transiciones simultáneas del mismo documento se serializan (la fila queda bloqueada). */
  async ejecutar(
    id: string,
    nuevoEstado: EstadoDocumento,
    actor: ActorDocumento = ACTOR_SISTEMA,
    motivo?: string | null,
  ): Promise<Documento> {
    return this.transaccion.ejecutar(async (contexto) => {
      const documento = await this.repo.buscarPorId(id, contexto);
      if (!documento) {
        throw new NotFoundException(`Documento ${id} no encontrado`);
      }
      documento.transicionarA(nuevoEstado, actor, motivo);
      await this.repo.guardar(documento, contexto);
      return documento;
    });
  }
}
