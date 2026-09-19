import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import {
  CerrarInspeccionUseCase,
  ConsumoInsumoCommand,
} from '../application/cerrar-inspeccion.usecase';

export class ConsumoInsumoDto implements ConsumoInsumoCommand {
  @ApiProperty({
    example: 'i1111111-1111-1111-1111-111111111111',
    description: 'ID del insumo químico en catálogo',
  })
  insumoId!: string;

  @ApiProperty({ example: '10 ml/L', description: 'Dosis real aplicada en campo' })
  dosisAplicada!: string;

  @ApiProperty({ example: 'LOTE-2026-X', description: 'Número de lote del fabricante' })
  lote!: string;

  @ApiProperty({ example: 2.5, description: 'Cantidad consumida' })
  cantidadUtilizada!: number;
}

export class CerrarInspeccionDto {
  @ApiProperty({
    type: [ConsumoInsumoDto],
    required: false,
    description: 'Insumos químicos aplicados durante la inspección',
  })
  consumos?: ConsumoInsumoDto[];
}

export class CrearInspeccionDto {
  @ApiProperty({
    example: 's1111111-1111-1111-1111-111111111111',
    description: 'ID del servicio contratado',
  })
  servicioId!: string;
}

@ApiTags('Operaciones')
@Controller('operaciones/inspecciones')
export class OperacionesController {
  constructor(
    private readonly registrarInspeccion: RegistrarInspeccionUseCase,
    private readonly cerrarInspeccion: CerrarInspeccionUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nueva inspección en estado BORRADOR' })
  @ApiResponse({ status: 201, description: 'Inspección creada' })
  async crear(@Body() dto: CrearInspeccionDto) {
    const inspeccion = await this.registrarInspeccion.ejecutar(dto.servicioId);
    return {
      id: inspeccion.id,
      servicioId: inspeccion.servicioId,
      codigoInspeccion: inspeccion.codigoInspeccion,
      estado: inspeccion.getEstado(),
      versionSync: inspeccion.getVersionSync(),
    };
  }

  @Post(':id/cerrar')
  @ApiOperation({
    summary:
      'Cerrar inspección y congelar snapshot inmutable de catálogos (Regla de Inmutabilidad Contractual Sección 13)',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspección cerrada con snapshot inmutable',
  })
  async cerrar(
    @Param('id') id: string,
    @Body() dto?: CerrarInspeccionDto,
  ) {
    const inspeccion = await this.cerrarInspeccion.execute({
      inspeccionId: id,
      consumos: dto?.consumos,
    });
    return {
      id: inspeccion.id,
      estado: inspeccion.getEstado(),
      snapshotCatalogos: inspeccion.getSnapshot(),
      versionSync: inspeccion.getVersionSync(),
    };
  }
}
