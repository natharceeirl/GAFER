import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Inspeccion } from '../domain/inspeccion';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../domain/ports/inspeccion.repository';
import {
  INSUMO_REPOSITORY,
  InsumoRepository,
} from '../../mantenimiento/domain/ports/insumo.repository';

export interface ConsumoInsumoCommand {
  insumoId: string;
  dosisAplicada: string;
  lote: string;
  cantidadUtilizada: number;
}

export interface CerrarInspeccionCommand {
  inspeccionId: string;
  consumos?: ConsumoInsumoCommand[];
}

@Injectable()
export class CerrarInspeccionUseCase {
  constructor(
    @Inject(INSPECCION_REPOSITORY)
    private readonly inspeccionRepo: InspeccionRepository,
    @Inject(INSUMO_REPOSITORY)
    private readonly insumoRepo: InsumoRepository,
  ) {}

  async execute(command: CerrarInspeccionCommand): Promise<Inspeccion> {
    const inspeccion = await this.inspeccionRepo.buscarPorId(command.inspeccionId);
    if (!inspeccion) {
      throw new NotFoundException(`Inspección ${command.inspeccionId} no encontrada`);
    }

    if (inspeccion.getEstado() === 'CERRADO') {
      throw new ConflictException('La inspección ya está cerrada y bloqueada contra ediciones');
    }

    // Construir snapshot inmutable de los insumos según Sección 13
    const snapshotInsumos = [];
    if (command.consumos && command.consumos.length > 0) {
      for (const consumo of command.consumos) {
        const insumoCatalogo = await this.insumoRepo.buscarPorId(consumo.insumoId);
        if (insumoCatalogo) {
          snapshotInsumos.push({
            insumoId: insumoCatalogo.id,
            nombreHistorico: insumoCatalogo.nombreComercial,
            principioActivo: insumoCatalogo.principioActivo,
            presentacion: insumoCatalogo.presentacion,
            unidadMedida: insumoCatalogo.unidadMedida,
            registroDigesa: insumoCatalogo.registroDigesa,
            concentracion: insumoCatalogo.concentracion,
            dosisAplicada: consumo.dosisAplicada,
            lote: consumo.lote,
            cantidadUtilizada: consumo.cantidadUtilizada,
            congeladoEn: new Date().toISOString(),
          });
        }
      }
    }

    const snapshotFinal = {
      insumos: snapshotInsumos,
      fechaCierre: new Date().toISOString(),
    };

    inspeccion.cerrar(snapshotFinal);
    await this.inspeccionRepo.guardar(inspeccion);
    return inspeccion;
  }

  // Compatibilidad hacia atrás
  async ejecutar(id: string): Promise<Inspeccion> {
    return this.execute({ inspeccionId: id });
  }
}
