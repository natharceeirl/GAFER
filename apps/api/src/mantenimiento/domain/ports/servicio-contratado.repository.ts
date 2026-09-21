import { ServicioContratado } from '../servicio-contratado';

export const SERVICIO_CONTRATADO_REPOSITORY = Symbol('SERVICIO_CONTRATADO_REPOSITORY');

export interface ServicioContratadoRepository {
  guardar(servicio: ServicioContratado): Promise<void>;
  buscarPorId(id: string): Promise<ServicioContratado | null>;
  buscarPorProyectoId(proyectoId: string): Promise<ServicioContratado[]>;
}
