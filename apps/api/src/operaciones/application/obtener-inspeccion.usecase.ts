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
}
