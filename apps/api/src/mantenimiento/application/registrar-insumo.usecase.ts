import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Insumo } from '../domain/insumo';
import { INSUMO_REPOSITORY, InsumoRepository } from '../domain/ports/insumo.repository';

@Injectable()
export class RegistrarInsumoUseCase {
  constructor(
    @Inject(INSUMO_REPOSITORY) private readonly repo: InsumoRepository,
  ) {}

  async ejecutar(nombreProducto: string, registroDigesa: string, dosisReferencial: string): Promise<Insumo> {
    const insumo = new Insumo(randomUUID(), nombreProducto, registroDigesa, dosisReferencial);
    await this.repo.guardar(insumo);
    return insumo;
  }
}
