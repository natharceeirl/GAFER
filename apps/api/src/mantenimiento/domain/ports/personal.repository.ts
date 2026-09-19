import { Personal } from '../personal';

export const PERSONAL_REPOSITORY = Symbol('PERSONAL_REPOSITORY');

export interface PersonalRepository {
  guardar(personal: Personal): Promise<void>;
  buscarPorId(id: string): Promise<Personal | null>;
  buscarPorDni(dni: string): Promise<Personal | null>;
  buscarPorUsuario(usuario: string): Promise<Personal | null>;
  listarActivos(): Promise<Personal[]>;
}
