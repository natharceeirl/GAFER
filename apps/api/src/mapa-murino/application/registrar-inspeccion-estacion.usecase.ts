import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Estacion } from '../domain/estacion';
import { ESTACION_REPOSITORY, EstacionRepository } from '../domain/ports/estacion.repository';

@Injectable()
export class RegistrarInspeccionEstacionUseCase {
  constructor(
    @Inject(ESTACION_REPOSITORY) private readonly repo: EstacionRepository,
  ) {}

  async ejecutar(estacionId: string, huboConsumo: boolean): Promise<Estacion> {
    const estacion = await this.repo.buscarPorId(estacionId);
    if (!estacion) {
      throw new NotFoundException(`Estación ${estacionId} no encontrada`);
    }
    estacion.registrarInspeccion(huboConsumo);
    await this.repo.guardar(estacion);
    return estacion;
  }
}
