import { Estacion } from '../estacion';

export interface EstacionRepository {
  guardar(estacion: Estacion): Promise<void>;
  buscarPorId(id: string): Promise<Estacion | null>;
}

export const ESTACION_REPOSITORY = Symbol('ESTACION_REPOSITORY');
