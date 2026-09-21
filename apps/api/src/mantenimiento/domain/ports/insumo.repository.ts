import { Insumo } from '../insumo';

export const INSUMO_REPOSITORY = Symbol('INSUMO_REPOSITORY');

export interface InsumoRepository {
  guardar(insumo: Insumo): Promise<void>;
  buscarPorId(id: string): Promise<Insumo | null>;
  buscarPorDigesa(registroDigesa: string): Promise<Insumo | null>;
  listarActivos(): Promise<Insumo[]>;
}
