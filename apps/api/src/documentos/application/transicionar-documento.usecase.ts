import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Documento, EstadoDocumento } from '../domain/documento';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';

@Injectable()
export class TransicionarDocumentoUseCase {
  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
  ) {}

  async ejecutar(id: string, nuevoEstado: EstadoDocumento): Promise<Documento> {
    const documento = await this.repo.buscarPorId(id);
    if (!documento) {
      throw new NotFoundException(`Documento ${id} no encontrado`);
    }
    documento.transicionarA(nuevoEstado);
    await this.repo.guardar(documento);
    return documento;
  }
}
