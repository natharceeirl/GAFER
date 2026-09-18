import { Cliente } from '../cliente';

export interface ClienteRepository {
  guardar(cliente: Cliente): Promise<void>;
  buscarPorId(id: string): Promise<Cliente | null>;
  buscarPorCodigoCorto(codigoCorto: string): Promise<Cliente | null>;
}

export const CLIENTE_REPOSITORY = Symbol('CLIENTE_REPOSITORY');
