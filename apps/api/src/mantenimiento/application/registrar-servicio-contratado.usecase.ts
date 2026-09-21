import { Inject, Injectable } from '@nestjs/common';
import { ServicioContratado, ServicioContratadoProps } from '../domain/servicio-contratado';
import { SERVICIO_CONTRATADO_REPOSITORY, ServicioContratadoRepository } from '../domain/ports/servicio-contratado.repository';
import { PROYECTO_REPOSITORY, ProyectoRepository } from '../domain/ports/proyecto.repository';

export type RegistrarServicioContratadoCommand = ServicioContratadoProps;

@Injectable()
export class RegistrarServicioContratadoUseCase {
  constructor(
    @Inject(SERVICIO_CONTRATADO_REPOSITORY)
    private readonly servicioRepository: ServicioContratadoRepository,
    @Inject(PROYECTO_REPOSITORY)
    private readonly proyectoRepository: ProyectoRepository,
  ) {}

  async execute(command: RegistrarServicioContratadoCommand): Promise<ServicioContratado> {
    const proyecto = await this.proyectoRepository.buscarPorId(command.proyectoId);
    if (!proyecto) {
      throw new Error(`No se encontró la sede/proyecto con ID: ${command.proyectoId}`);
    }

    if (proyecto.getEstado() !== 'ACTIVO') {
      throw new Error('No se pueden asignar servicios a una sede inactiva');
    }

    const servicio = new ServicioContratado(command);
    await this.servicioRepository.guardar(servicio);
    return servicio;
  }
}
