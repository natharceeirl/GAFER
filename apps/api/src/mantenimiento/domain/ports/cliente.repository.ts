import { Cliente } from '../cliente';

export const CLIENTE_REPOSITORY = Symbol('CLIENTE_REPOSITORY');

export interface ClienteRepository {
  guardar(cliente: Cliente): Promise<void>;
  buscarPorId(id: string): Promise<Cliente | null>;
  buscarPorRuc(ruc: string): Promise<Cliente | null>;
  buscarPorCodigoCorto(codigoCorto: string): Promise<Cliente | null>;
  listarTodos(): Promise<Cliente[]>;
}
