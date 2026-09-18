import { Inspeccion } from '../inspeccion';

export interface InspeccionRepository {
  guardar(inspeccion: Inspeccion): Promise<void>;
  buscarPorId(id: string): Promise<Inspeccion | null>;
}

export const INSPECCION_REPOSITORY = Symbol('INSPECCION_REPOSITORY');
