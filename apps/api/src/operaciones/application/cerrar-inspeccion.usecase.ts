import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Inspeccion } from '../domain/inspeccion';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../domain/ports/inspeccion.repository';
import {
  INSUMO_REPOSITORY,
  InsumoRepository,
} from '../../mantenimiento/domain/ports/insumo.repository';
import {
  EQUIPO_REPOSITORY,
  EquipoRepository,
} from '../../mantenimiento/domain/ports/equipo.repository';
import {
  PERSONAL_REPOSITORY,
  PersonalRepository,
} from '../../mantenimiento/domain/ports/personal.repository';

export interface ConsumoInsumoCommand {
  insumoId: string;
  dosisAplicada: string;
  lote: string;
  cantidadUtilizada: number;
}

export interface CerrarInspeccionCommand {
  inspeccionId: string;
  consumos?: ConsumoInsumoCommand[];
  equiposIds?: string[];
  personalIds?: string[];
}

@Injectable()
export class CerrarInspeccionUseCase {
  constructor(
    @Inject(INSPECCION_REPOSITORY)
    private readonly inspeccionRepo: InspeccionRepository,
    @Inject(INSUMO_REPOSITORY)
    private readonly insumoRepo: InsumoRepository,
    @Optional()
    @Inject(EQUIPO_REPOSITORY)
    private readonly equipoRepo?: EquipoRepository,
    @Optional()
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepo?: PersonalRepository,
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
        if (!insumoCatalogo) {
          throw new BadRequestException(
            `El insumo con ID ${consumo.insumoId} no existe en el catálogo`,
          );
        }

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

    // Construir snapshot inmutable de los equipos según Sección 13 / GAP-04
    const snapshotEquipos = [];
    if (command.equiposIds && command.equiposIds.length > 0) {
      if (!this.equipoRepo) {
        throw new Error('EquipoRepository no disponible para congelar equipos');
      }
      for (const equipoId of command.equiposIds) {
        const equipoCatalogo = await this.equipoRepo.buscarPorId(equipoId);
        if (!equipoCatalogo) {
          throw new BadRequestException(
            `El equipo con ID ${equipoId} no existe en el catálogo`,
          );
        }

        snapshotEquipos.push({
          equipoId: equipoCatalogo.id,
          codigoInterno: equipoCatalogo.codigoInterno,
          nombre: equipoCatalogo.nombre,
          tipo: equipoCatalogo.tipo,
          marcaModelo: equipoCatalogo.marcaModelo,
          estadoOperativo: equipoCatalogo.getEstadoOperativo(),
          congeladoEn: new Date().toISOString(),
        });
      }
    }

    // Construir snapshot inmutable del personal técnico según Sección 13 / GAP-04
    const snapshotPersonal = [];
    const tecnicosParticipantes: Array<{ id: string; nombre: string }> = [];
    if (command.personalIds && command.personalIds.length > 0) {
      if (!this.personalRepo) {
        throw new Error('PersonalRepository no disponible para congelar personal');
      }
      for (const personalId of command.personalIds) {
        const personalCatalogo = await this.personalRepo.buscarPorId(personalId);
        if (!personalCatalogo) {
          throw new BadRequestException(
            `El personal con ID ${personalId} no existe en el catálogo`,
          );
        }

        snapshotPersonal.push({
          personalId: personalCatalogo.id,
          dni: personalCatalogo.dni,
          nombres: personalCatalogo.nombres,
          apellidos: personalCatalogo.apellidos,
          nombreCompleto: personalCatalogo.nombreCompleto,
          cargo: personalCatalogo.cargo,
          congeladoEn: new Date().toISOString(),
        });

        tecnicosParticipantes.push({
          id: personalCatalogo.id,
          nombre: personalCatalogo.nombreCompleto,
        });
      }
    }

    const snapshotFinal = {
      insumos: snapshotInsumos,
      equipos: snapshotEquipos,
      personal: snapshotPersonal,
      fechaCierre: new Date().toISOString(),
    };

    inspeccion.cerrar(snapshotFinal, tecnicosParticipantes);
    await this.inspeccionRepo.guardar(inspeccion);
    return inspeccion;
  }

  // Compatibilidad hacia atrás
  async ejecutar(id: string): Promise<Inspeccion> {
    return this.execute({ inspeccionId: id });
  }
}
