import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import {
  CerrarInspeccionUseCase,
  ConsumoInsumoCommand,
} from '../application/cerrar-inspeccion.usecase';
import { ObtenerInspeccionUseCase } from '../application/obtener-inspeccion.usecase';
import {
  ApiCrearInspeccionDoc,
  ApiCerrarInspeccionDoc,
  ApiObtenerInspeccionPorIdDoc,
  ApiConsultarInspeccionDoc,
} from './operaciones.controller.doc';
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

  @ApiProperty({
    type: [String],
    required: false,
    example: ['e1111111-1111-1111-1111-111111111111'],
    description: 'IDs de equipos utilizados en campo',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true, message: 'Cada equipoId debe ser un UUID válido' })
  equiposIds?: string[];

  @ApiProperty({
    type: [String],
    required: false,
    example: ['p1111111-1111-1111-1111-111111111111'],
    description: 'IDs del personal técnico participante',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true, message: 'Cada personalId debe ser un UUID válido' })
  personalIds?: string[];
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
    private readonly obtenerInspeccion: ObtenerInspeccionUseCase,
  ) {}

  @Post()
  @ApiCrearInspeccionDoc()
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

  @Get()
  @ApiConsultarInspeccionDoc()
  async consultar(@Query('servicioId') servicioId?: string) {
    if (!servicioId) {
      return null;
    }
    const inspeccion = await this.obtenerInspeccion.ejecutarPorServicioId(servicioId);
    if (!inspeccion) {
      return null;
    }
    return {
      id: inspeccion.id,
      servicioId: inspeccion.servicioId,
      codigoInspeccion: inspeccion.codigoInspeccion,
      estado: inspeccion.getEstado(),
      versionSync: inspeccion.getVersionSync(),
      fechaEjecucion: inspeccion.fechaEjecucion,
      horaInicio: inspeccion.horaInicio,
      horaFin: inspeccion.horaFin,
      tecnicosParticipantes: inspeccion.tecnicosParticipantes,
      snapshotCatalogos: inspeccion.getSnapshot(),
    };
  }

  @Get(':id')
  @ApiObtenerInspeccionPorIdDoc()
  async obtenerPorId(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const inspeccion = await this.obtenerInspeccion.ejecutarPorId(id);
    return {
      id: inspeccion.id,
      servicioId: inspeccion.servicioId,
      codigoInspeccion: inspeccion.codigoInspeccion,
      estado: inspeccion.getEstado(),
      versionSync: inspeccion.getVersionSync(),
      fechaEjecucion: inspeccion.fechaEjecucion,
      horaInicio: inspeccion.horaInicio,
      horaFin: inspeccion.horaFin,
      tecnicosParticipantes: inspeccion.tecnicosParticipantes,
      snapshotCatalogos: inspeccion.getSnapshot(),
    };
  }

  @Post(':id/cerrar')
  @ApiCerrarInspeccionDoc()
  async cerrar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto?: CerrarInspeccionDto,
  ) {
    const inspeccion = await this.cerrarInspeccion.execute({
      inspeccionId: id,
      consumos: dto?.consumos,
      equiposIds: dto?.equiposIds,
      personalIds: dto?.personalIds,
    });
    return {
      id: inspeccion.id,
      estado: inspeccion.getEstado(),
      tecnicosParticipantes: inspeccion.tecnicosParticipantes,
      snapshotCatalogos: inspeccion.getSnapshot(),
      versionSync: inspeccion.getVersionSync(),
    };
  }
}
