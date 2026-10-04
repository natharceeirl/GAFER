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
  CatalogoTextoResponseDto,
  ConfiguracionSistemaResponseDto,
  AuditoriaPaginadaResponseDto,
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

export function ApiObtenerProyectoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Obtener detalle de una sede/proyecto por ID' }),
    ApiParam({ name: 'id', description: 'UUID de la sede/proyecto' }),
    ApiResponse({ status: 200, description: 'Sede/proyecto encontrada', type: ProyectoResponseDto }),
    ApiResponse({ status: 400, description: 'UUID inválido', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Sede no encontrada', type: NotFoundErrorDto }),
  );
}

export function ApiActualizarProyectoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Actualizar datos de una sede/proyecto existente' }),
    ApiParam({ name: 'id', description: 'UUID de la sede/proyecto' }),
    ApiResponse({ status: 200, description: 'Sede/proyecto actualizada', type: ProyectoResponseDto }),
    ApiResponse({ status: 400, description: 'Datos inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Sede no encontrada', type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'Nombre de sede duplicado para este cliente', type: ConflictErrorDto }),
  );
}

export function ApiDesactivarProyectoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Desactivar una sede/proyecto (baja lógica)' }),
    ApiParam({ name: 'id', description: 'UUID de la sede/proyecto' }),
    ApiResponse({ status: 200, description: 'Sede desactivada', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Sede no encontrada', type: NotFoundErrorDto }),
  );
}

export function ApiActivarProyectoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Reactivar una sede/proyecto previamente desactivada' }),
    ApiParam({ name: 'id', description: 'UUID de la sede/proyecto' }),
    ApiResponse({ status: 200, description: 'Sede reactivada', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Sede no encontrada', type: NotFoundErrorDto }),
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

export function ApiObtenerServicioContratadoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Obtener detalle de un servicio contratado por ID' }),
    ApiParam({ name: 'id', description: 'UUID del servicio contratado' }),
    ApiResponse({ status: 200, description: 'Servicio contratado encontrado', type: ServicioContratadoResponseDto }),
    ApiResponse({ status: 400, description: 'UUID inválido', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Servicio contratado no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActualizarServicioContratadoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Actualizar un servicio contratado' }),
    ApiParam({ name: 'id', description: 'UUID del servicio contratado' }),
    ApiResponse({ status: 200, description: 'Servicio contratado actualizado', type: ServicioContratadoResponseDto }),
    ApiResponse({ status: 400, description: 'Datos inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Servicio contratado no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiDesactivarServicioContratadoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Desactivar un servicio contratado (baja lógica)' }),
    ApiParam({ name: 'id', description: 'UUID del servicio contratado' }),
    ApiResponse({ status: 200, description: 'Servicio desactivado', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Servicio contratado no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActivarServicioContratadoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Reactivar un servicio contratado previamente desactivado' }),
    ApiParam({ name: 'id', description: 'UUID del servicio contratado' }),
    ApiResponse({ status: 200, description: 'Servicio reactivado', type: EstadoSimpleResponseDto }),
    ApiResponse({ status: 404, description: 'Servicio contratado no encontrado', type: NotFoundErrorDto }),
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

export function ApiObtenerInsumoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Obtener detalle de un insumo por ID' }),
    ApiParam({ name: 'id', description: 'UUID del insumo' }),
    ApiResponse({ status: 200, description: 'Insumo encontrado', type: InsumoResponseDto }),
    ApiResponse({ status: 404, description: 'Insumo no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActualizarInsumoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Actualizar parcialmente un insumo del catálogo' }),
    ApiParam({ name: 'id', description: 'UUID del insumo' }),
    ApiResponse({ status: 200, description: 'Insumo actualizado exitosamente', type: InsumoResponseDto }),
    ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Insumo no encontrado', type: NotFoundErrorDto }),
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

export function ApiActivarInsumoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Reactivar un insumo del catálogo previamente desactivado' }),
    ApiParam({ name: 'id', description: 'UUID del insumo' }),
    ApiResponse({ status: 200, description: 'Insumo reactivado', type: EstadoSimpleResponseDto }),
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

export function ApiObtenerEquipoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Obtener detalle de un equipo por ID' }),
    ApiParam({ name: 'id', description: 'UUID del equipo' }),
    ApiResponse({ status: 200, description: 'Equipo encontrado', type: EquipoResponseDto }),
    ApiResponse({ status: 404, description: 'Equipo no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActualizarEquipoDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Actualizar datos de un equipo operativo' }),
    ApiParam({ name: 'id', description: 'UUID del equipo' }),
    ApiResponse({ status: 200, description: 'Equipo actualizado exitosamente', type: EquipoResponseDto }),
    ApiResponse({ status: 400, description: 'Datos inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Equipo no encontrado', type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'Código interno ya registrado', type: ConflictErrorDto }),
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

export function ApiObtenerPersonalDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Obtener detalle de un colaborador/personal por ID' }),
    ApiParam({ name: 'id', description: 'UUID del colaborador' }),
    ApiResponse({ status: 200, description: 'Personal encontrado', type: PersonalResponseDto }),
    ApiResponse({ status: 404, description: 'Personal no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActualizarPersonalDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Actualizar datos de un colaborador' }),
    ApiParam({ name: 'id', description: 'UUID del colaborador' }),
    ApiResponse({ status: 200, description: 'Personal actualizado exitosamente', type: PersonalResponseDto }),
    ApiResponse({ status: 400, description: 'Datos inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, description: 'Personal no encontrado', type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'DNI o usuario ya registrado', type: ConflictErrorDto }),
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

export function ApiActivarPersonalDoc() {
  return applyDecorators(
    ApiOperation({ summary: 'Reactivar un colaborador previamente desactivado' }),
    ApiParam({ name: 'id', description: 'UUID del colaborador' }),
    ApiResponse({ status: 200, description: 'Personal reactivado', type: EstadoSimpleResponseDto }),
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

// ==========================================
// CATALOGOS DE TEXTO
// ==========================================

export function ApiListarCatalogosTextoDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar catálogos de texto editables del sistema',
      description: 'Devuelve todos los catálogos de texto disponibles. Los catálogos restringidos (ej. motivos-modificacion) se filtran si el usuario no es ADMINISTRADOR.',
    }),
    ApiResponse({ status: 200, description: 'Listado de catálogos de texto', type: [CatalogoTextoResponseDto] }),
  );
}

export function ApiObtenerCatalogoTextoDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener un catálogo de texto por ID',
      description: 'Devuelve los items de texto del catálogo solicitado. Requiere rol ADMINISTRADOR para catálogos restringidos.',
    }),
    ApiParam({ name: 'id', description: 'Identificador del catálogo', example: 'hallazgos' }),
    ApiResponse({ status: 200, description: 'Catálogo de texto encontrado', type: CatalogoTextoResponseDto }),
    ApiResponse({ status: 403, description: 'Acceso restringido a rol ADMINISTRADOR' }),
    ApiResponse({ status: 404, description: 'Catálogo no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiActualizarCatalogoTextoDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar la lista completa de items de un catálogo de texto',
      description: 'Reemplaza la lista ordenada de items. Registra evento inmutable en la bitácora de auditoría. Garantiza que documentos e inspecciones pasadas permanezcan intactos (§13).',
    }),
    ApiParam({ name: 'id', description: 'Identificador del catálogo', example: 'hallazgos' }),
    ApiResponse({ status: 200, description: 'Catálogo actualizado exitosamente', type: CatalogoTextoResponseDto }),
    ApiResponse({ status: 400, description: 'Estructura de items inválida', type: BadRequestErrorDto }),
    ApiResponse({ status: 403, description: 'Permisos insuficientes para modificar el catálogo' }),
    ApiResponse({ status: 404, description: 'Catálogo no encontrado', type: NotFoundErrorDto }),
  );
}

export function ApiAgregarItemCatalogoTextoDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Agregar un nuevo item de texto a un catálogo existente',
      description: 'Agrega un ítem al catálogo sin duplicados y genera registro en auditoría.',
    }),
    ApiParam({ name: 'id', description: 'Identificador del catálogo', example: 'hallazgos' }),
    ApiResponse({ status: 201, description: 'Item agregado exitosamente', type: CatalogoTextoResponseDto }),
    ApiResponse({ status: 400, description: 'Texto del item inválido', type: BadRequestErrorDto }),
    ApiResponse({ status: 403, description: 'Permisos insuficientes para modificar el catálogo' }),
    ApiResponse({ status: 404, description: 'Catálogo no encontrado', type: NotFoundErrorDto }),
  );
}

// ==========================================
// CONFIGURACION GLOBAL DEL SISTEMA
// ==========================================

export function ApiObtenerConfiguracionDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consultar configuración global del sistema',
      description: 'Devuelve datos del Director Técnico (nombre, CIP, firma para PDFs), resolución sanitaria y parámetros.',
    }),
    ApiResponse({ status: 200, description: 'Configuración global del sistema', type: ConfiguracionSistemaResponseDto }),
  );
}

export function ApiActualizarConfiguracionDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar configuración global del sistema (Exclusivo ADMINISTRADOR)',
      description: 'Permite modificar Director Técnico, CIP, firma digital o resolución sanitaria. Registra evento en auditoría.',
    }),
    ApiResponse({ status: 200, description: 'Configuración actualizada', type: ConfiguracionSistemaResponseDto }),
    ApiResponse({ status: 400, description: 'Datos de configuración inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 403, description: 'Acceso restringido a rol ADMINISTRADOR' }),
  );
}

// ==========================================
// BITÁCORA INMUTABLE DE AUDITORÍA
// ==========================================

export function ApiConsultarAuditoriaDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consultar registro inmutable de auditoría (Exclusivo ADMINISTRADOR - Decisión C6)',
      description: 'Permite filtrar el historial de acciones y modificaciones por módulo, entidad, usuario o rango de fechas.',
    }),
    ApiResponse({ status: 200, description: 'Listado paginado de eventos de auditoría', type: AuditoriaPaginadaResponseDto }),
    ApiResponse({ status: 400, description: 'Filtros o paginación inválidos', type: BadRequestErrorDto }),
    ApiResponse({ status: 403, description: 'Acceso restringido a rol ADMINISTRADOR' }),
  );
}

