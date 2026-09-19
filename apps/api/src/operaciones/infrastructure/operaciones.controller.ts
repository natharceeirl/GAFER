import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import {
  CerrarInspeccionUseCase,
  ConsumoInsumoCommand,
} from '../application/cerrar-inspeccion.usecase';
import {
  InspeccionResponseDto,
  InspeccionCerradaResponseDto,
} from './dto/operaciones-response.dto';
import { ErrorResponseDto } from '../../mantenimiento/infrastructure/dto/mantenimiento-response.dto';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsumoInsumoDto implements ConsumoInsumoCommand {
  @ApiProperty({
    example: 'i1111111-1111-1111-1111-111111111111',
    description: 'ID del insumo químico en catálogo',
  })
  @IsUUID('all', { message: 'El insumoId debe ser un UUID válido' })
  insumoId!: string;

  @ApiProperty({ example: '10 ml/L', description: 'Dosis real aplicada en campo' })
  @IsString()
  @IsNotEmpty({ message: 'La dosis aplicada es obligatoria' })
  dosisAplicada!: string;

  @ApiProperty({ example: 'LOTE-2026-X', description: 'Número de lote del fabricante' })
  @IsString()
  @IsNotEmpty({ message: 'El número de lote es obligatorio' })
  lote!: string;

  @ApiProperty({ example: 2.5, description: 'Cantidad consumida' })
  @IsNumber()
  @Min(0.01, { message: 'La cantidad utilizada debe ser mayor a 0' })
  cantidadUtilizada!: number;
}

export class CerrarInspeccionDto {
  @ApiProperty({
    type: [ConsumoInsumoDto],
    required: false,
    description: 'Insumos químicos aplicados durante la inspección',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumoInsumoDto)
  consumos?: ConsumoInsumoDto[];
}

export class CrearInspeccionDto {
  @ApiProperty({
    example: 's1111111-1111-1111-1111-111111111111',
    description: 'ID del servicio contratado',
  })
  @IsUUID('all', { message: 'El servicioId debe ser un UUID válido' })
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
  @ApiOperation({
    summary: 'Registrar nueva inspección en estado BORRADOR',
    description: 'Crea una orden o reporte de inspección de campo vinculada a un servicio contratado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Inspección creada exitosamente en borrador',
    type: InspeccionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de inspección inválidos o faltantes',
    type: ErrorResponseDto,
  })
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
    summary: 'Cerrar inspección y congelar snapshot inmutable (Sección 13)',
    description:
      'Cierra la inspección de campo, bloqueándola permanentemente contra modificaciones y congelando una copia exacta (snapshot JSONB) del catálogo de insumos utilizados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la inspección a cerrar',
    example: 'insp-1111111-1111-1111-1111-111111111111',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspección cerrada con snapshot inmutable congelado',
    type: InspeccionCerradaResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Inspección no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'La inspección ya se encuentra cerrada y bloqueada',
    type: ErrorResponseDto,
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
