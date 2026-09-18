import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Inspeccion } from '../domain/inspeccion';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../domain/ports/inspeccion.repository';

@Injectable()
export class CerrarInspeccionUseCase {
  constructor(
    @Inject(INSPECCION_REPOSITORY) private readonly repo: InspeccionRepository,
  ) {}

  async ejecutar(id: string): Promise<Inspeccion> {
    const inspeccion = await this.repo.buscarPorId(id);
    if (!inspeccion) {
      throw new NotFoundException(`Inspección ${id} no encontrada`);
    }
    inspeccion.cerrar();
    await this.repo.guardar(inspeccion);
    return inspeccion;
  }
}
