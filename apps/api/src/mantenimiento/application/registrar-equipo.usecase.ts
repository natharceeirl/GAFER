import { Inject, Injectable } from '@nestjs/common';
import { Equipo, EquipoProps } from '../domain/equipo';
import { EQUIPO_REPOSITORY, EquipoRepository } from '../domain/ports/equipo.repository';

export type RegistrarEquipoCommand = EquipoProps;

@Injectable()
export class RegistrarEquipoUseCase {
  constructor(
    @Inject(EQUIPO_REPOSITORY)
    private readonly equipoRepository: EquipoRepository,
  ) {}

  async execute(command: RegistrarEquipoCommand): Promise<Equipo> {
    const existing = await this.equipoRepository.buscarPorCodigoInterno(command.codigoInterno);
    if (existing) {
      throw new Error(`Ya existe un equipo registrado con el código interno: ${command.codigoInterno}`);
    }

    const equipo = new Equipo(command);
    await this.equipoRepository.guardar(equipo);
    return equipo;
  }
}
