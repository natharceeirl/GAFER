import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EQUIPO_REPOSITORY, EquipoRepository } from '../domain/ports/equipo.repository';
import { Equipo, EstadoOperativoEquipo, TipoEquipo } from '../domain/equipo';

export interface ActualizarEquipoCommand {
  id: string;
  codigoInterno?: string;
  nombre?: string;
  tipo?: TipoEquipo;
  marcaModelo?: string | null;
  estadoOperativo?: EstadoOperativoEquipo;
  fechaAdquisicion?: string | null;
  ultimoMantenimiento?: string | null;
  proximoMantenimiento?: string | null;
}

@Injectable()
export class ActualizarEquipoUseCase {
  constructor(
    @Inject(EQUIPO_REPOSITORY)
    private readonly equipoRepository: EquipoRepository,
  ) {}

  async execute(command: ActualizarEquipoCommand): Promise<Equipo> {
    const equipo = await this.equipoRepository.buscarPorId(command.id);
    if (!equipo) {
      throw new NotFoundException(`Equipo con ID ${command.id} no encontrado`);
    }

    if (command.codigoInterno && command.codigoInterno.trim().toUpperCase() !== equipo.codigoInterno) {
      const existing = await this.equipoRepository.buscarPorCodigoInterno(
        command.codigoInterno.trim().toUpperCase(),
      );
      if (existing && existing.id !== command.id) {
        throw new ConflictException(
          `Ya existe un equipo registrado con el código interno: ${command.codigoInterno}`,
        );
      }
    }

    equipo.actualizarDatos(command);
    await this.equipoRepository.guardar(equipo);
    return equipo;
  }
}
