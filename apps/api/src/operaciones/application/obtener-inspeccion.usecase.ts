import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Inspeccion } from '../domain/inspeccion';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../domain/ports/inspeccion.repository';

@Injectable()
export class ObtenerInspeccionUseCase {
  constructor(
    @Inject(INSPECCION_REPOSITORY) private readonly repo: InspeccionRepository,
  ) {}

  async ejecutarPorId(id: string): Promise<Inspeccion> {
    const inspeccion = await this.repo.buscarPorId(id);
    if (!inspeccion) {
      throw new NotFoundException(`Inspección ${id} no encontrada`);
    }
    return inspeccion;
  }

  async ejecutarPorServicioId(servicioId: string): Promise<Inspeccion | null> {
    return this.repo.buscarPorServicioId(servicioId);
  }

  async ejecutarPorTecnico(tecnicoId: string): Promise<Inspeccion[]> {
    return this.repo.listarPorTecnico(tecnicoId);
  }

  async ejecutarTodas(): Promise<Inspeccion[]> {
    if (this.repo.listarTodas) {
      return this.repo.listarTodas();
    }
    return [];
  }
}
