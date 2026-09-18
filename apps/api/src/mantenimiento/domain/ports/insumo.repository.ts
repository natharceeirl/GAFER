import { Insumo } from '../insumo';

export interface InsumoRepository {
  guardar(insumo: Insumo): Promise<void>;
  buscarPorId(id: string): Promise<Insumo | null>;
  listarActivos(): Promise<Insumo[]>;
}

export const INSUMO_REPOSITORY = Symbol('INSUMO_REPOSITORY');
