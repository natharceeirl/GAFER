import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EQUIPO_REPOSITORY, EquipoRepository } from '../domain/ports/equipo.repository';
import { Equipo, EstadoOperativoEquipo } from '../domain/equipo';

@Injectable()
export class ActualizarEstadoEquipoUseCase {
  constructor(
    @Inject(EQUIPO_REPOSITORY)
    private readonly equipoRepository: EquipoRepository,
  ) {}

  async execute(id: string, nuevoEstado: EstadoOperativoEquipo): Promise<Equipo> {
    const equipo = await this.equipoRepository.buscarPorId(id);
    if (!equipo) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    equipo.cambiarEstadoOperativo(nuevoEstado);
    await this.equipoRepository.guardar(equipo);
    return equipo;
  }
}
