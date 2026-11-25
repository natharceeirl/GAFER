import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DOCUMENTO_REPOSITORY,
  DocumentoDetalleLectura,
  DocumentoRepository,
} from '../domain/ports/documento.repository';

@Injectable()
export class ObtenerDocumentoUseCase {
  constructor(@Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository) {}

  async ejecutar(id: string): Promise<DocumentoDetalleLectura> {
    const detalle = await this.repo.obtenerDetalle(id);
    if (!detalle) {
      throw new NotFoundException(`Documento ${id} no encontrado`);
    }
    return detalle;
  }
}
