import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SERVICIO_CONTRATADO_REPOSITORY,
  ServicioContratadoRepository,
} from '../domain/ports/servicio-contratado.repository';
import { FrecuenciaServicio, ServicioContratado } from '../domain/servicio-contratado';

export interface ActualizarServicioContratadoCommand {
  id: string;
  frecuencia?: FrecuenciaServicio;
  areaTotalM2?: number;
  areaTratarM2?: number;
  insumosAutorizados?: string[];
  equiposAutorizados?: string[];
  dosisReferencial?: Record<string, string>;
  requiereCertificado?: boolean;
  vigenciaDias?: number | null;
}

@Injectable()
export class ActualizarServicioContratadoUseCase {
  constructor(
    @Inject(SERVICIO_CONTRATADO_REPOSITORY)
    private readonly servicioRepository: ServicioContratadoRepository,
  ) {}

  async execute(command: ActualizarServicioContratadoCommand): Promise<ServicioContratado> {
    const servicio = await this.servicioRepository.buscarPorId(command.id);
    if (!servicio) {
      throw new NotFoundException(`Servicio contratado con ID ${command.id} no encontrado`);
    }

    servicio.actualizarDatos(command);
    await this.servicioRepository.guardar(servicio);
    return servicio;
  }
}
