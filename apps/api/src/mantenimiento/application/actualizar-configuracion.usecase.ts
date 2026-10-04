import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfiguracionSistema } from '../domain/configuracion-sistema';
import {
  CONFIGURACION_REPOSITORY,
  ConfiguracionRepository,
} from '../domain/ports/configuracion.repository';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';

export interface ActualizarConfiguracionCommand {
  director?: {
    nombre: string;
    cip: string;
    firma?: string | null;
  };
  resolucionSanitaria?: string;
  parametros?: Record<string, unknown>;
  actorId?: string | null;
  actorUsuario: string;
  actorRol: string;
}

@Injectable()
export class ActualizarConfiguracionUseCase {
  constructor(
    @Inject(CONFIGURACION_REPOSITORY)
    private readonly repository: ConfiguracionRepository,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async execute(command: ActualizarConfiguracionCommand): Promise<ConfiguracionSistema> {
    if (command.actorRol !== 'ADMINISTRADOR') {
      throw new ForbiddenException(
        'Solo ADMINISTRADOR puede actualizar la configuración del sistema',
      );
    }

    const config = await this.repository.obtener();

    const payloadAnterior = {
      director: {
        nombre: config.directorNombre,
        cip: config.directorCip,
        firma: config.directorFirma,
      },
      resolucionSanitaria: config.resolucionSanitaria,
      parametros: config.parametros,
    };

    if (command.director) {
      config.actualizarDirector(
        command.director.nombre,
        command.director.cip,
        command.director.firma,
      );
    }

    if (command.resolucionSanitaria !== undefined) {
      config.actualizarResolucionSanitaria(command.resolucionSanitaria);
    }

    if (command.parametros !== undefined) {
      config.actualizarParametros(command.parametros);
    }

    config.actualizadoPor = command.actorId ?? null;
    await this.repository.guardar(config);

    await this.auditoriaService.registrarEvento({
      actorId: command.actorId ?? null,
      actorUsuario: command.actorUsuario,
      actorRol: command.actorRol,
      modulo: 'CONFIGURACION',
      accion: 'ACTUALIZAR_CONFIGURACION_SISTEMA',
      entidad: 'configuracion_sistema',
      entidadId: 'global',
      payloadAnterior,
      payloadNuevo: {
        director: {
          nombre: config.directorNombre,
          cip: config.directorCip,
          firma: config.directorFirma,
        },
        resolucionSanitaria: config.resolucionSanitaria,
        parametros: config.parametros,
      },
    });

    return config;
  }
}
