import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Inspeccion } from '../domain/inspeccion';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../domain/ports/inspeccion.repository';

@Injectable()
export class RegistrarInspeccionUseCase {
  constructor(
    @Inject(INSPECCION_REPOSITORY) private readonly repo: InspeccionRepository,
  ) {}

  async ejecutar(servicioId: string): Promise<Inspeccion> {
    const inspeccion = new Inspeccion(randomUUID(), servicioId);
    await this.repo.guardar(inspeccion);
    return inspeccion;
  }
}
