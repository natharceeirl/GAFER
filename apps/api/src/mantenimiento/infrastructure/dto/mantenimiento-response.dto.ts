import { ApiProperty } from '@nestjs/swagger';
export * from '../../../shared/infrastructure/dto/error-response.dto';
import { BadRequestErrorDto } from '../../../shared/infrastructure/dto/error-response.dto';

export class ErrorResponseDto extends BadRequestErrorDto {}

export class ClienteResponseDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'Identificador único UUID' })
  id!: string;

  @ApiProperty({ example: 'Kallpa Generacion S.A.', description: 'Razón social legal' })
  razonSocial!: string;

  @ApiProperty({ example: '20508565434', description: 'RUC exacto de 11 dígitos' })
  ruc!: string;

  @ApiProperty({ example: 'KALLPA', description: 'Código corto alfanumérico GAFER' })
  codigoCorto!: string;

  @ApiProperty({ example: 'ACTIVO', enum: ['ACTIVO', 'INACTIVO'] })
  estado!: 'ACTIVO' | 'INACTIVO';

  @ApiProperty({ example: 'Generación Eléctrica' })
  giroNegocio!: string;

  @ApiProperty({ example: 'Carlos Ramos' })
  contactoNombre!: string;

  @ApiProperty({ example: '958123456' })
  contactoTelefono!: string;

  @ApiProperty({ example: 'cramos@kallpa.pe' })
  contactoCorreo!: string;
}

export class ClienteDetalleResponseDto extends ClienteResponseDto {
  @ApiProperty({ example: 'Av. Las Palmas 123, Mollendo' })
  direccionFiscal!: string;

  @ApiProperty({ example: 'Jefe de SSOMA' })
  contactoCargo!: string;

  @ApiProperty({ example: {}, description: 'Metadatos adicionales' })
  camposExtra!: Record<string, unknown>;
}

export class ClientePaginadoResponseDto {
  @ApiProperty({ example: 10, description: 'Total de clientes que cumplen el criterio' })
  total!: number;

  @ApiProperty({ example: 20, description: 'Límite de registros por página' })
  limit!: number;

  @ApiProperty({ example: 0, description: 'Desplazamiento actual' })
  offset!: number;

  @ApiProperty({ type: [ClienteResponseDto], description: 'Listado de clientes' })
  items!: ClienteResponseDto[];
}

export class ProyectoResponseDto {
  @ApiProperty({ example: 'p1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111' })
  clienteId!: string;

  @ApiProperty({ example: 'PLANTA_SUR' })
  nombre!: string;

  @ApiProperty({ example: 'Carretera Costanera Km 12' })
  direccionSede!: string;

  @ApiProperty({ example: 'Mollendo' })
  distrito!: string;

  @ApiProperty({ example: 'Islay' })
  provincia!: string;

  @ApiProperty({ example: 'Arequipa' })
  departamento!: string;

  @ApiProperty({ example: 'Mario Vargas' })
  contactoNombre!: string;

  @ApiProperty({ example: 'Supervisor de Planta' })
  contactoCargo!: string;

  @ApiProperty({ example: '954987654' })
  contactoTelefono!: string;

  @ApiProperty({ example: 'ACTIVO', enum: ['ACTIVO', 'INACTIVO'] })
  estado!: 'ACTIVO' | 'INACTIVO';

  @ApiProperty({ example: 'Requerido pase médico y EPP', nullable: true })
  observaciones!: string | null;
}

export class ServicioContratadoResponseDto {
  @ApiProperty({ example: 's1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'p1111111-1111-1111-1111-111111111111' })
  proyectoId!: string;

  @ApiProperty({ example: 'DSF', enum: ['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM'] })
  tipoServicio!: string;

  @ApiProperty({ example: 'MENSUAL' })
  frecuencia!: string;

  @ApiProperty({ example: 5000.5 })
  areaTotalM2!: number;

  @ApiProperty({ example: 3500.0 })
  areaTratarM2!: number;

  @ApiProperty({ example: ['i1111111-1111-4111-8111-111111111111'], description: 'IDs de insumos autorizados' })
  insumosAutorizados!: string[];

  @ApiProperty({ example: ['e1111111-1111-4111-8111-111111111111'], description: 'IDs de equipos autorizados' })
  equiposAutorizados!: string[];

  @ApiProperty({ example: { 'i1111111-1111-4111-8111-111111111111': '5 ml / Litro' }, description: 'Dosis referencial por insumo' })
  dosisReferencial!: Record<string, string>;

  @ApiProperty({ example: true })
  requiereCertificado!: boolean;

  @ApiProperty({ example: 30, nullable: true })
  vigenciaDias!: number | null;

  @ApiProperty({ example: 'ACTIVO', enum: ['ACTIVO', 'INACTIVO'] })
  estado!: 'ACTIVO' | 'INACTIVO';
}

export class InsumoResponseDto {
  @ApiProperty({ example: 'i1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'Cipermetrina 25%' })
  nombreComercial!: string;

  @ApiProperty({ example: 'Cipermetrina' })
  principioActivo!: string;

  @ApiProperty({ example: 'LIQUIDO' })
  presentacion!: string;

  @ApiProperty({ example: 'L' })
  unidadMedida!: string;

  @ApiProperty({ example: 'RD-1425-2024/DIGESA/SA' })
  registroDigesa!: string;

  @ApiProperty({ example: '25% p/v' })
  concentracion!: string;

  @ApiProperty({ example: '5 ml / Litro de agua' })
  dosisEstandar!: string;

  @ApiProperty({ example: 'insumos/fichas/cipermetrina-25.pdf' })
  fichaTecnicaKey!: string;

  @ApiProperty({ example: 'insumos/msds/cipermetrina-25.pdf' })
  hojaMsdsKey!: string;

  @ApiProperty({ example: 'insumos/resoluciones/rd-1425.pdf', nullable: true })
  resolucionKey?: string | null;

  @ApiProperty({ example: 'Bayer S.A.', nullable: true })
  proveedor?: string | null;

  @ApiProperty({ example: 'ACTIVO', enum: ['ACTIVO', 'INACTIVO'] })
  estado!: 'ACTIVO' | 'INACTIVO';
}

export class InsumoPaginadoResponseDto {
  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ type: [InsumoResponseDto] })
  items!: InsumoResponseDto[];
}

export class EquipoResponseDto {
  @ApiProperty({ example: 'e1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'EQ-NEB-01' })
  codigoInterno!: string;

  @ApiProperty({ example: 'Nebulizadora ULV Vector Fog C-150' })
  nombre!: string;

  @ApiProperty({ example: 'NEBULIZACION' })
  tipo!: string;

  @ApiProperty({ example: 'Vector Fog C-150', nullable: true })
  marcaModelo?: string | null;

  @ApiProperty({ example: 'OPERATIVO', enum: ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO'] })
  estadoOperativo!: 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO';

  @ApiProperty({ example: '2026-01-15', nullable: true })
  fechaAdquisicion?: string | null;

  @ApiProperty({ example: '2026-06-01', nullable: true })
  ultimoMantenimiento?: string | null;

  @ApiProperty({ example: '2026-12-01', nullable: true })
  proximoMantenimiento?: string | null;
}

export class EquipoPaginadoResponseDto {
  @ApiProperty({ example: 8 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ type: [EquipoResponseDto] })
  items!: EquipoResponseDto[];
}

export class PersonalResponseDto {
  @ApiProperty({ example: 'u1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: '45892312' })
  dni!: string;

  @ApiProperty({ example: 'Juan' })
  nombres!: string;

  @ApiProperty({ example: 'Perez Gomez' })
  apellidos!: string;

  @ApiProperty({ example: 'TECNICO_OPERADOR', enum: ['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR'] })
  cargo!: 'ADMINISTRADOR' | 'SUPERVISOR' | 'TECNICO_OPERADOR';

  @ApiProperty({ example: '958123456' })
  telefono!: string;

  @ApiProperty({ example: 'JPEREZ', nullable: true })
  usuario?: string | null;

  @ApiProperty({ example: 'ACTIVO', enum: ['ACTIVO', 'INACTIVO'] })
  estado!: 'ACTIVO' | 'INACTIVO';
}

export class PersonalPaginadoResponseDto {
  @ApiProperty({ example: 5 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ type: [PersonalResponseDto] })
  items!: PersonalResponseDto[];
}

export class UploadUrlResponseDto {
  @ApiProperty({ example: 'insumos/fichas/ficha-cipermetrina.pdf' })
  key!: string;

  @ApiProperty({ example: 'https://s3.gafer.pe/gafer-docs/insumos/fichas/ficha-cipermetrina.pdf?X-Amz-Signature=...' })
  uploadUrl!: string;

  @ApiProperty({ example: 'gafer-docs' })
  bucket!: string;

  @ApiProperty({ example: 900, description: 'Vigencia de la URL en segundos (15 min)' })
  expiresInSeconds!: number;
}

export class DownloadUrlResponseDto {
  @ApiProperty({ example: 'insumos/fichas/ficha-cipermetrina.pdf' })
  key!: string;

  @ApiProperty({ example: 'https://s3.gafer.pe/gafer-docs/insumos/fichas/ficha-cipermetrina.pdf?X-Amz-Signature=...' })
  downloadUrl!: string;

  @ApiProperty({ example: 3600, description: 'Vigencia de la URL en segundos (1 hora)' })
  expiresInSeconds!: number;
}

export class EstadoSimpleResponseDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'INACTIVO' })
  estado!: string;
}

export class CatalogoTextoResponseDto {
  @ApiProperty({ example: 'hallazgos', description: 'Identificador único del catálogo' })
  id!: string;

  @ApiProperty({ example: 'Hallazgos frecuentes', description: 'Título descriptivo del catálogo' })
  titulo!: string;

  @ApiProperty({
    example: ['CUCARACHA AMERICANA (Periplaneta americana)'],
    description: 'Lista de items de texto del catálogo',
    type: [String],
  })
  items!: string[];

  @ApiProperty({ example: false, description: 'Indica si es de acceso exclusivo para ADMINISTRADOR' })
  soloAdministrador?: boolean;
}

export class DirectorTecnicoResponseDto {
  @ApiProperty({ example: 'Ing. Carlos Medina Ruiz', description: 'Nombre completo del Director Técnico' })
  nombre!: string;

  @ApiProperty({ example: '84512', description: 'Número de CIP (Colegio de Ingenieros del Perú)' })
  cip!: string;

  @ApiProperty({
    example: 'data:image/png;base64,...',
    nullable: true,
    required: false,
    description: 'Firma gráfica en base64 o URI de almacenamiento para estampado automático en PDFs',
  })
  firma?: string | null;
}

export class ConfiguracionSistemaResponseDto {
  @ApiProperty({ example: 'global', description: 'Identificador único de configuración' })
  id!: string;

  @ApiProperty({ type: DirectorTecnicoResponseDto, nullable: true, required: false })
  director?: DirectorTecnicoResponseDto | null;

  @ApiProperty({ example: '0023-2024-DESA/MINSA', description: 'Resolución Sanitaria oficial' })
  resolucionSanitaria!: string;

  @ApiProperty({ example: {}, description: 'Parámetros globales del sistema' })
  parametros!: Record<string, unknown>;

  @ApiProperty({ example: 'ADMIN', nullable: true, required: false })
  actualizadoPor?: string | null;

  @ApiProperty({ example: '2026-10-04T00:00:00.000Z', required: false })
  updatedAt?: string;
}

export class EventoAuditoriaResponseDto {
  @ApiProperty({ example: 'a1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'u1111111-1111-1111-1111-111111111111', nullable: true, required: false })
  actorId?: string | null;

  @ApiProperty({ example: 'ADMIN' })
  actorUsuario!: string;

  @ApiProperty({ example: 'ADMINISTRADOR' })
  actorRol!: string;

  @ApiProperty({ example: 'MANTENIMIENTO' })
  modulo!: string;

  @ApiProperty({ example: 'ACTUALIZAR_CATALOGO_TEXTO' })
  accion!: string;

  @ApiProperty({ example: 'catalogo_texto' })
  entidad!: string;

  @ApiProperty({ example: 'hallazgos' })
  entidadId!: string;

  @ApiProperty({ example: { items: [] }, nullable: true, required: false })
  payloadAnterior?: Record<string, unknown> | null;

  @ApiProperty({ example: { items: ['CUCARACHA'] }, nullable: true, required: false })
  payloadNuevo?: Record<string, unknown> | null;

  @ApiProperty({ example: {} })
  detalles!: Record<string, unknown>;

  @ApiProperty({ example: '2026-10-04T00:00:00.000Z' })
  createdAt!: string;
}

export class AuditoriaPaginadaResponseDto {
  @ApiProperty({ example: 42, description: 'Total de eventos registrados' })
  total!: number;

  @ApiProperty({ example: 20, description: 'Límite de registros' })
  limit!: number;

  @ApiProperty({ example: 0, description: 'Desplazamiento' })
  offset!: number;

  @ApiProperty({ type: [EventoAuditoriaResponseDto], description: 'Eventos de auditoría' })
  items!: EventoAuditoriaResponseDto[];
}

