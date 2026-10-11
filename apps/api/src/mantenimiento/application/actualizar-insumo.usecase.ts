import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  resolucionKey?: string | null;
  proveedor?: string | null;
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

    if (command.registroDigesa !== undefined) {
      const digesaLimpio = command.registroDigesa.trim();
      if (digesaLimpio !== insumo.registroDigesa) {
        const existing = await this.insumoRepository.buscarPorDigesa(digesaLimpio);
        if (existing && existing.id !== command.id) {
          throw new ConflictException(
            `Ya existe un insumo registrado con el código DIGESA: ${digesaLimpio}`,
          );
        }
      }
    }

    insumo.actualizar(command);
    await this.insumoRepository.guardar(insumo);
    return insumo;
  }
}
