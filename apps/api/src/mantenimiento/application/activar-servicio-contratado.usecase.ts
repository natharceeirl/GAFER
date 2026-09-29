import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SERVICIO_CONTRATADO_REPOSITORY,
  ServicioContratadoRepository,
} from '../domain/ports/servicio-contratado.repository';
import { ServicioContratado } from '../domain/servicio-contratado';

@Injectable()
export class ActivarServicioContratadoUseCase {
  constructor(
    @Inject(SERVICIO_CONTRATADO_REPOSITORY)
    private readonly servicioRepository: ServicioContratadoRepository,
  ) {}

  async execute(id: string): Promise<ServicioContratado> {
    const servicio = await this.servicioRepository.buscarPorId(id);
    if (!servicio) {
      throw new NotFoundException(`Servicio contratado con ID ${id} no encontrado`);
    }

    servicio.activar();
    await this.servicioRepository.guardar(servicio);
    return servicio;
  }
}
