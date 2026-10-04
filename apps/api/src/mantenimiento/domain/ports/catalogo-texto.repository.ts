import { CatalogoTexto } from '../catalogo-texto';

export interface CatalogoTextoRepository {
  buscarPorId(id: string): Promise<CatalogoTexto | null>;
  listar(): Promise<CatalogoTexto[]>;
  guardar(catalogo: CatalogoTexto): Promise<void>;
}

export const CATALOGO_TEXTO_REPOSITORY = Symbol('CATALOGO_TEXTO_REPOSITORY');
