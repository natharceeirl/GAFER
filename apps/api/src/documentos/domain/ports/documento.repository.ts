import { Documento } from '../documento';

export interface DocumentoRepository {
  guardar(documento: Documento): Promise<void>;
  buscarPorId(id: string): Promise<Documento | null>;
}

export const DOCUMENTO_REPOSITORY = Symbol('DOCUMENTO_REPOSITORY');
