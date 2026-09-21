import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { INSUMO_REPOSITORY, InsumoRepository } from '../domain/ports/insumo.repository';
import { Insumo } from '../domain/insumo';

@Injectable()
export class DesactivarInsumoUseCase {
  constructor(
    @Inject(INSUMO_REPOSITORY)
    private readonly insumoRepository: InsumoRepository,
  ) {}

  async execute(id: string): Promise<Insumo> {
    const insumo = await this.insumoRepository.buscarPorId(id);
    if (!insumo) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }

    insumo.desactivar();
    await this.insumoRepository.guardar(insumo);
    return insumo;
  }
}
