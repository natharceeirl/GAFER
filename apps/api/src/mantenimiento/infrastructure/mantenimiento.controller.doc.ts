import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  ClienteResponseDto,
  ClienteDetalleResponseDto,
  ClientePaginadoResponseDto,
  ProyectoResponseDto,
  ServicioContratadoResponseDto,
  InsumoResponseDto,
  InsumoPaginadoResponseDto,
  EquipoResponseDto,
  EquipoPaginadoResponseDto,
  PersonalResponseDto,
  PersonalPaginadoResponseDto,
  UploadUrlResponseDto,
  DownloadUrlResponseDto,
  EstadoSimpleResponseDto,
  BadRequestErrorDto,
  NotFoundErrorDto,
  ConflictErrorDto,
} from './dto/mantenimiento-response.dto';

// ==========================================
// CLIENTES
// ==========================================

export function ApiCrearClienteDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar nuevo cliente corporativo con RUC y código corto',
      description: 'Valida RUC exacto de 11 dígitos, unicidad de código corto alfanumérico y formato de correo.',
    }),
    ApiResponse({ status: 201, description: 'Cliente registrado exitosamente', type: ClienteResponseDto }),
    ApiResponse({ status: 400, description: 'Sintaxis o formato de datos inválido (RUC o correo)', type: BadRequestErrorDto }),
    ApiResponse({ status: 409, description: 'RUC o código corto ya registrado en el sistema', type: ConflictErrorDto }),
  );
}

export function ApiListarClientesDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar clientes registrados con paginación y búsqueda',
      description: 'Permite filtrar por razón social, RUC o código corto con paginación (limit/offset).',
    }),
    ApiResponse({ status: 200, description: 'Listado paginado de clientes', type: ClientePaginadoResponseDto }),
    ApiResponse({ status: 400, description: 'Parámetros de paginación o búsqueda inválidos', type: BadRequestErrorDto }),
  );
}

export function ApiObtenerClienteDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener detalle completo de un cliente por ID',
      description: 'Devuelve datos fiscales, de contacto y campos personalizados.',
    }),
    ApiParam({ name: 'id', description: 'UUID del cliente', example: 'c1111111-1111-1111-1111-111111111111' }),
    ApiResponse({ status: 200, description: 'Detalle del cliente encontrado', type: ClienteDetalleResponseDto }),
    ApiResponse({ status: 400, description: 'ID de cliente con formato UUID inválido', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActualizarClienteDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar datos de un cliente existente',
      description: 'Modifica razón social, dirección fiscal, teléfono, cargo o correo de contacto.',
    }),
    ApiParam({ name: 'id', description: 'UUID del cliente', example: 'c1111111-1111-1111-1111-111111111111' }),
    ApiResponse({ status: 200, description: 'Cliente actualizado exitosamente', type: ClienteDetalleResponseDto }),
    ApiResponse({ status: 400, description: 'Campos de actualización con formato inválido', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiDesactivarClienteDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Desactivar un cliente (baja lógica)' }),
    ApiParam({ name: 'id', description: 'UUID del cliente' }),
    ApiResponse({ status: 200, description: 'Cliente desactivado', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActivarClienteDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Reactivar un cliente previamente desactivado' }),
    ApiParam({ name: 'id', description: 'UUID del cliente' }),
    ApiResponse({ status: 200, description: 'Cliente reactivado', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Cliente no encontrado', type: NotFoundErrorDto }),
  );
}

// ==========================================
// SEDES / PROYECTOS
// ==========================================

export function ApiCrearProyectoDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar una sede o proyecto vinculado a un cliente',
      description: 'Valida nombre único por cliente en mayúsculas sin espacios (ej. PLANTA_SUR).',
    }),
    ApiResponse({ status: 201, description: 'Sede/proyecto registrado exitosamente', type: ProyectoResponseDto }),
    ApiResponse({ status: 400, description: 'Cliente inactivo o datos inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Cliente propietario no encontrado', type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'Nombre de sede duplicado para este cliente', type: ConflictErrorDto }),
  );
}

export function ApiListarProyectosPorClienteDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Listar todas las sedes de un cliente' }),
    ApiParam({ name: 'clienteId', description: 'UUID del cliente' }),
    ApiResponse({ status: 200, description: 'Listado de sedes del cliente', type: [ProyectoResponseDto] }),
    ApiResponse({ status: 400, description: 'UUID de cliente inválido', type: BadRequestErrorDto }),
  );
}

// ==========================================
// SERVICIOS CONTRATADOS
// ==========================================

export function ApiCrearServicioContratadoDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar un servicio ambiental contratado para una sede',
      description: 'Valida uno de los 7 tipos oficiales (DSF, DSS, DRT, etc.) y áreas coherentes.',
    }),
    ApiResponse({ status: 201, description: 'Servicio contratado registrado exitosamente', type: ServicioContratadoResponseDto }),
    ApiResponse({ status: 400, description: 'Áreas inconsistentes (tratar > total) o tipo no válido', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Sede/proyecto no encontrada', type: NotFoundErrorDto }),
  );
}

export function ApiListarServiciosPorProyectoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Listar servicios contratados de una sede' }),
    ApiParam({ name: 'proyectoId', description: 'UUID de la sede' }),
    ApiResponse({ status: 200, description: 'Servicios de la sede', type: [ServicioContratadoResponseDto] }),
    ApiResponse({ status: 400, description: 'UUID de sede inválido', type: BadRequestErrorDto }),
  );
}

// ==========================================
// INSUMOS QUÍMICOS
// ==========================================

export function ApiCrearInsumoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Registrar insumo químico con registro DIGESA y referencias MinIO S3' }),
    ApiResponse({ status: 201, description: 'Insumo registrado exitosamente', type: InsumoResponseDto }),
    ApiResponse({ status: 400, description: 'Campos requeridos faltantes o formato inválido', type: BadRequestErrorDto }),
    ApiResponse({ status: 409, description: 'Registro DIGESA ya existente en el catálogo', type: ConflictErrorDto }),
  );
}

export function ApiListarInsumosDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Listar catálogo de insumos químicos activos con paginación' }),
    ApiResponse({ status: 200, description: 'Catálogo paginado de insumos', type: InsumoPaginadoResponseDto }),
    ApiResponse({ status: 400, description: 'Parámetros de consulta inválidos', type: BadRequestErrorDto }),
  );
}

export function ApiDesactivarInsumoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Desactivar un insumo del catálogo' }),
    ApiParam({ name: 'id', description: 'UUID del insumo' }),
    ApiResponse({ status: 200, description: 'Insumo desactivado', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Insumo no encontrado', type: NotFoundErrorDto }),
  );
}

// ==========================================
// EQUIPOS OPERATIVOS
// ==========================================

export function ApiCrearEquipoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Registrar equipo operativo con código interno GAFER' }),
    ApiResponse({ status: 201, description: 'Equipo registrado exitosamente', type: EquipoResponseDto }),
    ApiResponse({ status: 400, description: 'Datos del equipo inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 409, description: 'Código interno de equipo duplicado', type: ConflictErrorDto }),
  );
}

export function ApiListarEquiposDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Listar catálogo de equipos operativos con paginación' }),
    ApiResponse({ status: 200, description: 'Catálogo paginado de equipos', type: EquipoPaginadoResponseDto }),
    ApiResponse({ status: 400, description: 'Parámetros inválidos', type: BadRequestErrorDto }),
  );
}

export function ApiCambiarEstadoEquipoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Actualizar estado operativo del equipo (OPERATIVO, MANTENIMIENTO, FUERA_SERVICIO)' }),
    ApiParam({ name: 'id', description: 'UUID del equipo' }),
    ApiResponse({ status: 200, description: 'Estado operativo actualizado', type: EquipoResponseDto }),
    ApiResponse({ status: 400, description: 'Estado operativo no válido', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Equipo no encontrado', type: NotFoundErrorDto }),
  );
}

// ==========================================
// PERSONAL TÉCNICO Y SUPERVISORES
// ==========================================

export function ApiCrearPersonalDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Registrar personal técnico o supervisor con DNI de 8 dígitos' }),
    ApiResponse({ status: 201, description: 'Personal registrado exitosamente', type: PersonalResponseDto }),
    ApiResponse({ status: 400, description: 'DNI no contiene 8 dígitos numéricos o campos inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 409, description: 'DNI o nombre de usuario ya registrado', type: ConflictErrorDto }),
  );
}

export function ApiListarPersonalDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Listar personal técnico y supervisores activos con paginación' }),
    ApiResponse({ status: 200, description: 'Listado de personal activo', type: PersonalPaginadoResponseDto }),
    ApiResponse({ status: 400, description: 'Parámetros inválidos', type: BadRequestErrorDto }),
  );
}

export function ApiDesactivarPersonalDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Desactivar personal o colaborador (baja lógica)' }),
    ApiParam({ name: 'id', description: 'UUID del colaborador' }),
    ApiResponse({ status: 200, description: 'Personal desactivado', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Personal no encontrado', type: NotFoundErrorDto }),
  );
}

// ==========================================
// STORAGE S3 (MINIO)
// ==========================================

export function ApiGenerarUploadUrlDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Generar URL prefirmada para subida directa de fichas técnicas o MSDS a MinIO S3',
      description: 'Devuelve una URL prefirmada con PUT para subir archivos PDF directamente desde el cliente.',
    }),
    ApiResponse({ status: 200, description: 'URL prefirmada generada exitosamente (PUT)', type: UploadUrlResponseDto }),
    ApiResponse({ status: 400, description: 'Clave de archivo o content-type inválido', type: BadRequestErrorDto }),
  );
}

export function ApiGenerarDownloadUrlDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Generar URL prefirmada para visualización o descarga segura desde MinIO S3',
      description: 'Devuelve una URL temporal segura (1 hora) con GET para consultar el archivo.',
    }),
    ApiResponse({ status: 200, description: 'URL prefirmada de descarga generada (GET)', type: DownloadUrlResponseDto }),
    ApiResponse({ status: 400, description: 'Clave de archivo requerida', type: BadRequestErrorDto }),
  );
}
