import { Proyecto } from '../proyecto';

export const PROYECTO_REPOSITORY = Symbol('PROYECTO_REPOSITORY');

export interface ProyectoRepository {
  guardar(proyecto: Proyecto): Promise<void>;
  buscarPorId(id: string): Promise<Proyecto | null>;
  buscarPorClienteId(clienteId: string): Promise<Proyecto[]>;
  buscarPorClienteYNombre(clienteId: string, nombre: string): Promise<Proyecto | null>;
}
