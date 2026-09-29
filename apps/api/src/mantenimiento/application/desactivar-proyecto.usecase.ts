import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PROYECTO_REPOSITORY, ProyectoRepository } from '../domain/ports/proyecto.repository';
import { Proyecto } from '../domain/proyecto';

@Injectable()
export class DesactivarProyectoUseCase {
  constructor(
    @Inject(PROYECTO_REPOSITORY)
    private readonly proyectoRepository: ProyectoRepository,
  ) {}

  async execute(id: string): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.buscarPorId(id);
    if (!proyecto) {
      throw new NotFoundException(`Sede/Proyecto con ID ${id} no encontrado`);
    }

    proyecto.desactivar();
    await this.proyectoRepository.guardar(proyecto);
    return proyecto;
  }
}
