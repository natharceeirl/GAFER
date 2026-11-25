import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENTO_REPOSITORY,
  DocumentoRepository,
  DocumentoResumenLectura,
  FiltroDocumentos,
} from '../domain/ports/documento.repository';

@Injectable()
export class ListarDocumentosUseCase {
  constructor(@Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository) {}

  /** Cola de revisión del Supervisor: `estado = ENVIADO_A_REVISION`. */
  async ejecutar(filtro: FiltroDocumentos = {}): Promise<DocumentoResumenLectura[]> {
    return this.repo.listar(filtro);
  }
}
