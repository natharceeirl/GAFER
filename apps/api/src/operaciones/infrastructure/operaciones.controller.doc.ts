import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  InspeccionResponseDto,
  InspeccionCerradaResponseDto,
} from './dto/operaciones-response.dto';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  NotFoundErrorDto,
} from '../../shared/infrastructure/dto/error-response.dto';

export function ApiCrearInspeccionDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar nueva inspección en estado BORRADOR',
      description: 'Crea una orden o reporte de inspección de campo vinculada a un servicio contratado.',
    }),
    ApiResponse({
      status: 201,
      description: 'Inspección creada exitosamente en borrador',
      type: InspeccionResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Datos de inspección inválidos o faltantes',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Servicio contratado asociado no encontrado',
      type: NotFoundErrorDto,
    }),
  );
}

export function ApiCerrarInspeccionDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cerrar inspección y congelar snapshot inmutable (Sección 13)',
      description:
        'Cierra la inspección de campo, bloqueándola permanentemente contra modificaciones y congelando una copia exacta (snapshot JSONB) del catálogo de insumos utilizados.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la inspección a cerrar',
      example: 'insp-1111111-1111-1111-1111-111111111111',
    }),
    ApiResponse({
      status: 200,
      description: 'Inspección cerrada con snapshot inmutable congelado',
      type: InspeccionCerradaResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Parámetros de cierre o consumos de insumo inválidos',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Inspección no encontrada',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: 409,
      description: 'La inspección ya se encuentra cerrada y bloqueada permanentemente',
      type: ConflictErrorDto,
    }),
  );
}
