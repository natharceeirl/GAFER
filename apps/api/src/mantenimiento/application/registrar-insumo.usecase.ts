import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Insumo, InsumoProps } from '../domain/insumo';
import { INSUMO_REPOSITORY, InsumoRepository } from '../domain/ports/insumo.repository';

export type RegistrarInsumoCommand = InsumoProps;

@Injectable()
export class RegistrarInsumoUseCase {
  constructor(
    @Inject(INSUMO_REPOSITORY)
    private readonly repo: InsumoRepository,
  ) {}

  async execute(command: RegistrarInsumoCommand): Promise<Insumo> {
    const existing = await this.repo.buscarPorDigesa(command.registroDigesa);
    if (existing) {
      throw new Error(`Ya existe un insumo registrado con el código DIGESA: ${command.registroDigesa}`);
    }

    const insumo = new Insumo(command);
    await this.repo.guardar(insumo);
    return insumo;
  }

  // Compatibilidad hacia atrás con el scaffold inicial
  async ejecutar(
    nombreProducto: string,
    registroDigesa: string,
    dosisReferencial: string,
  ): Promise<Insumo> {
    return this.execute({
      id: randomUUID(),
      nombreComercial: nombreProducto,
      principioActivo: 'GENERICO',
      presentacion: 'LIQUIDO',
      unidadMedida: 'L',
      registroDigesa,
      concentracion: '100%',
      dosisEstandar: dosisReferencial,
      fichaTecnicaKey: 'fichas/default.pdf',
      hojaMsdsKey: 'msds/default.pdf',
    });
  }
}
