import { Equipo } from '../equipo';

export const EQUIPO_REPOSITORY = Symbol('EQUIPO_REPOSITORY');

export interface EquipoRepository {
  guardar(equipo: Equipo): Promise<void>;
  buscarPorId(id: string): Promise<Equipo | null>;
  buscarPorCodigoInterno(codigoInterno: string): Promise<Equipo | null>;
  listarOperativos(): Promise<Equipo[]>;
  listarTodos(): Promise<Equipo[]>;
}
