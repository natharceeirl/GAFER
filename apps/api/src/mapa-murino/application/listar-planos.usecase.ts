import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MAPA_REPOSITORY, MapaRepository, PlanoMapa } from '../domain/ports/mapa.repository';

@Injectable()
export class ListarPlanosUseCase {
  constructor(@Inject(MAPA_REPOSITORY) private readonly repo: MapaRepository) {}

  async ejecutar(proyectoId: string): Promise<PlanoMapa[]> {
    if (!(await this.repo.proyectoExiste(proyectoId))) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
    return this.repo.listarPlanos(proyectoId);
  }
}
