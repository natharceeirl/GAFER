import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { INSUMO_REPOSITORY, InsumoRepository } from '../domain/ports/insumo.repository';
import { Insumo, PresentacionInsumo, UnidadMedidaInsumo } from '../domain/insumo';

export interface ActualizarInsumoCommand {
  id: string;
  nombreComercial?: string;
  principioActivo?: string;
  presentacion?: PresentacionInsumo;
  unidadMedida?: UnidadMedidaInsumo;
  registroDigesa?: string;
  concentracion?: string;
  dosisEstandar?: string;
  fichaTecnicaKey?: string;
  hojaMsdsKey?: string;
  resolucionKey?: string;
  proveedor?: string;
}

@Injectable()
export class ActualizarInsumoUseCase {
  constructor(
    @Inject(INSUMO_REPOSITORY)
    private readonly insumoRepository: InsumoRepository,
  ) {}

  async execute(command: ActualizarInsumoCommand): Promise<Insumo> {
    const insumo = await this.insumoRepository.buscarPorId(command.id);
    if (!insumo) {
      throw new NotFoundException(`Insumo con ID ${command.id} no encontrado`);
    }

    insumo.actualizar(command);
    await this.insumoRepository.guardar(insumo);
    return insumo;
  }
}
