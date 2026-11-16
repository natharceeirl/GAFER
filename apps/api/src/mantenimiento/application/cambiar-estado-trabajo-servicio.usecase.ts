import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SERVICIO_CONTRATADO_REPOSITORY,
  ServicioContratadoRepository,
} from '../domain/ports/servicio-contratado.repository';
import {
  EstadoTrabajo,
  MotivoObligatorioError,
  ServicioContratado,
  TransicionEstadoTrabajoError,
} from '../domain/servicio-contratado';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';

export interface CambiarEstadoTrabajoServicioCommand {
  id: string;
  estado: EstadoTrabajo;
  motivo?: string;
  actorId?: string | null;
  actorUsuario: string;
  actorRol: string;
}

/** GAF-99: cambia el estado de trabajo de un servicio contratado y deja el cambio en la bitácora de auditoría. */
@Injectable()
export class CambiarEstadoTrabajoServicioUseCase {
  constructor(
    @Inject(SERVICIO_CONTRATADO_REPOSITORY)
    private readonly servicioRepository: ServicioContratadoRepository,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async execute(command: CambiarEstadoTrabajoServicioCommand): Promise<ServicioContratado> {
    const servicio = await this.servicioRepository.buscarPorId(command.id);
    if (!servicio) {
      throw new NotFoundException(`Servicio contratado con ID ${command.id} no encontrado`);
    }

    const motivo = command.motivo?.trim() || null;
    const cambio = this.aplicar(servicio, command.estado, motivo ?? undefined);
    await this.servicioRepository.guardar(servicio);

    await this.auditoriaService.registrarEvento({
      actorId: command.actorId ?? null,
      actorUsuario: command.actorUsuario,
      actorRol: command.actorRol,
      modulo: 'MANTENIMIENTO',
      accion: cambio.reapertura ? 'REABRIR_SERVICIO' : 'CAMBIAR_ESTADO_TRABAJO_SERVICIO',
      entidad: 'servicio_contratado',
      entidadId: servicio.id,
      payloadAnterior: { estadoTrabajo: cambio.anterior },
      payloadNuevo: { estadoTrabajo: cambio.nuevo, motivo },
      detalles: { reapertura: cambio.reapertura },
    });

    return servicio;
  }

  /** Traduce las reglas del dominio a 400: el motivo faltante se señala en su campo, como un error de validación. */
  private aplicar(servicio: ServicioContratado, estado: EstadoTrabajo, motivo?: string) {
    try {
      return servicio.cambiarEstadoTrabajo(estado, motivo);
    } catch (error) {
      if (error instanceof MotivoObligatorioError) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: [`motivo: ${error.message}`],
          errors: [{ path: 'motivo', message: error.message }],
        });
      }
      if (error instanceof TransicionEstadoTrabajoError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
