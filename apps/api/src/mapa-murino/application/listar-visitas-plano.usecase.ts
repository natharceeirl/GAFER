import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { VisitaDelPlano } from '@gafer/contracts';
import { MAPA_REPOSITORY, MapaRepository } from '../domain/ports/mapa.repository';

@Injectable()
export class ListarVisitasPlanoUseCase {
  constructor(@Inject(MAPA_REPOSITORY) private readonly repo: MapaRepository) {}

  /** Visitas en que el plano tuvo registro, de la más antigua a la más reciente. */
  async ejecutar(planoId: string): Promise<VisitaDelPlano[]> {
    if (!(await this.repo.buscarPlano(planoId))) throw new NotFoundException(`Plano ${planoId} no encontrado`);
    const historial = await this.repo.historialDelPlano(planoId);
    return historial.map((v) => ({ visitaId: v.id, fecha: v.fecha, estaciones: v.eventos.length }));
  }
}
