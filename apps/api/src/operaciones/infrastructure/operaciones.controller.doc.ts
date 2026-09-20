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

export function ApiObtenerInspeccionPorIdDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener detalle completo de una inspección por ID',
      description: 'Retorna estado, participantes y el snapshot_catalogos congelado de la Sección 13.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la inspección',
      example: 'insp-1111111-1111-1111-1111-111111111111',
    }),
    ApiResponse({
      status: 200,
      description: 'Inspección encontrada',
      type: InspeccionResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'UUID de inspección inválido',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Inspección no encontrada',
      type: NotFoundErrorDto,
    }),
  );
}

export function ApiConsultarInspeccionDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consultar inspección activa por servicioId (usado por frontend web/móvil)',
      description: 'Permite a apps/web consultar si existe una inspección en curso vinculada a un servicio contratado.',
    }),
    ApiResponse({
      status: 200,
      description: 'Inspección asociada al servicio (o null si no existe)',
      type: InspeccionResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'UUID de servicio contratado inválido',
      type: BadRequestErrorDto,
    }),
  );
}

export function ApiConsultarAuditoriaDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consultar bitácora de auditoría de una inspección (Sección 8.4 / GAP-03)',
      description:
        'Obtiene el historial de eventos persistidos en inspecciones_auditoria (creación, cierre, guardado) asociados a la inspección.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la inspección',
      example: 'insp-1111111-1111-1111-1111-111111111111',
    }),
    ApiResponse({
      status: 200,
      description: 'Eventos de auditoría de la inspección',
    }),
    ApiResponse({
      status: 400,
      description: 'UUID de inspección inválido',
      type: BadRequestErrorDto,
    }),
  );
}

export function ApiSincronizarInspeccionDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Sincronizar lote de operaciones offline de campo (sync.v1 - GAP-02)',
      description:
        'Recibe y procesa idempotentemente un lote de operaciones capturadas en campo por técnicos, resolviendo colisiones y registrando auditoría.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la inspección a sincronizar',
      example: 'insp-1111111-1111-1111-1111-111111111111',
    }),
    ApiResponse({
      status: 200,
      description: 'Lote de sincronización procesado exitosamente',
    }),
    ApiResponse({
      status: 400,
      description: 'Parámetros o payload de operación inválidos',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Inspección no encontrada',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: 409,
      description: 'La inspección ya está cerrada y no acepta sincronizaciones',
      type: ConflictErrorDto,
    }),
  );
}
