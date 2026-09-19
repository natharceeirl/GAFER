import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'Código de estado HTTP' })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request', description: 'Nombre del error HTTP' })
  error!: string;

  @ApiProperty({
    example: 'El RUC debe tener exactamente 11 dígitos numéricos',
    description: 'Descripción detallada del error de validación o regla de negocio',
  })
  message!: string | string[];

  @ApiProperty({ example: '2026-09-19T19:00:00.000Z', description: 'Marca de tiempo ISO del error' })
  timestamp!: string;

  @ApiProperty({ example: '/mantenimiento/clientes', description: 'Ruta del endpoint solicitado' })
  path!: string;
}

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

  @ApiProperty({ example: '954987654' })
  contactoTelefono!: string;

  @ApiProperty({ example: 'ACTIVO', enum: ['ACTIVO', 'INACTIVO'] })
  estado!: 'ACTIVO' | 'INACTIVO';
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

  @ApiProperty({ example: 'TECNICO_OPERADOR', enum: ['SUPERVISOR', 'TECNICO_OPERADOR'] })
  cargo!: 'SUPERVISOR' | 'TECNICO_OPERADOR';

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
