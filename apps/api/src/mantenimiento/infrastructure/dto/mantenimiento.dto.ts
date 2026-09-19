import { ApiProperty } from '@nestjs/swagger';

export class CrearClienteDto {
  @ApiProperty({ example: 'Kallpa Generacion S.A.', description: 'Razón social legal' })
  razonSocial!: string;

  @ApiProperty({ example: '20508565434', description: 'RUC exacto de 11 dígitos' })
  ruc!: string;

  @ApiProperty({ example: 'KALLPA', description: 'Código corto alfanumérico en mayúsculas (3-10 car.)' })
  codigoCorto!: string;

  @ApiProperty({ example: 'Av. Las Palmas 123, Mollendo', description: 'Dirección fiscal' })
  direccionFiscal!: string;

  @ApiProperty({ example: 'Generación Eléctrica', description: 'Giro de negocio' })
  giroNegocio!: string;

  @ApiProperty({ example: 'Carlos Ramos', description: 'Persona de contacto' })
  contactoNombre!: string;

  @ApiProperty({ example: 'Jefe de SSOMA', description: 'Cargo del contacto' })
  contactoCargo!: string;

  @ApiProperty({ example: '958123456', description: 'Teléfono o celular' })
  contactoTelefono!: string;

  @ApiProperty({ example: 'cramos@kallpa.pe', description: 'Correo electrónico válido' })
  contactoCorreo!: string;

  @ApiProperty({ example: {}, required: false, description: 'Campos personalizados extra' })
  camposExtra?: Record<string, unknown>;
}

export class CrearProyectoDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'ID del cliente propietario' })
  clienteId!: string;

  @ApiProperty({ example: 'PLANTA_SUR', description: 'Nombre de la sede en mayúsculas y sin espacios' })
  nombre!: string;

  @ApiProperty({ example: 'Carretera Costanera Km 12', description: 'Dirección física de la sede' })
  direccionSede!: string;

  @ApiProperty({ example: 'Mollendo', description: 'Distrito' })
  distrito!: string;

  @ApiProperty({ example: 'Islay', description: 'Provincia' })
  provincia!: string;

  @ApiProperty({ example: 'Arequipa', description: 'Departamento' })
  departamento!: string;

  @ApiProperty({ example: 'Mario Vargas', description: 'Nombre del responsable en sede' })
  contactoNombre!: string;

  @ApiProperty({ example: 'Supervisor de Planta', description: 'Cargo' })
  contactoCargo!: string;

  @ApiProperty({ example: '954987654', description: 'Teléfono de la sede' })
  contactoTelefono!: string;

  @ApiProperty({ example: 'Requerido pase médico y EPP', required: false })
  observaciones?: string;
}

export class CrearServicioContratadoDto {
  @ApiProperty({ example: 'p1111111-1111-1111-1111-111111111111', description: 'ID de la sede/proyecto' })
  proyectoId!: string;

  @ApiProperty({ example: 'DSF', enum: ['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM'], description: 'Tipo de servicio' })
  tipoServicio!: 'DSF' | 'DSS' | 'DRT' | 'LRA' | 'LTG' | 'LTS' | 'LAM';

  @ApiProperty({ example: 'MENSUAL', enum: ['DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PUNTUAL'] })
  frecuencia!: 'DIARIA' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PUNTUAL';

  @ApiProperty({ example: 5000.5, description: 'Superficie total en m²' })
  areaTotalM2!: number;

  @ApiProperty({ example: 3500.0, description: 'Superficie efectiva a tratar en m²' })
  areaTratarM2!: number;

  @ApiProperty({ example: true, description: 'Si emite certificado de saneamiento' })
  requiereCertificado!: boolean;

  @ApiProperty({ example: 30, required: false, description: 'Vigencia del certificado en días' })
  vigenciaDias?: number;
}

export class CrearInsumoDto {
  @ApiProperty({ example: 'Cipermetrina 25%', description: 'Nombre comercial' })
  nombreComercial!: string;

  @ApiProperty({ example: 'Cipermetrina', description: 'Principio activo' })
  principioActivo!: string;

  @ApiProperty({ example: 'LIQUIDO', enum: ['LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO'] })
  presentacion!: 'LIQUIDO' | 'POLVO' | 'BLOQUE' | 'SOBRE' | 'GEL' | 'OTRO';

  @ApiProperty({ example: 'L', enum: ['ML', 'L', 'G', 'KG', 'SOBRE', 'BLOQUE', 'UNIDAD'] })
  unidadMedida!: 'ML' | 'L' | 'G' | 'KG' | 'SOBRE' | 'BLOQUE' | 'UNIDAD';

  @ApiProperty({ example: 'RD-1425-2024/DIGESA/SA', description: 'Registro DIGESA oficial' })
  registroDigesa!: string;

  @ApiProperty({ example: '25% p/v', description: 'Concentración' })
  concentracion!: string;

  @ApiProperty({ example: '5 ml / Litro de agua', description: 'Dosis estándar' })
  dosisEstandar!: string;

  @ApiProperty({ example: 'insumos/fichas/cipermetrina-25.pdf', description: 'Key en MinIO S3' })
  fichaTecnicaKey!: string;

  @ApiProperty({ example: 'insumos/msds/cipermetrina-25.pdf', description: 'Key en MinIO S3' })
  hojaMsdsKey!: string;

  @ApiProperty({ example: 'insumos/resoluciones/rd-1425.pdf', required: false })
  resolucionKey?: string;

  @ApiProperty({ example: 'Bayer S.A.', required: false })
  proveedor?: string;
}

export class CrearEquipoDto {
  @ApiProperty({ example: 'EQ-NEB-01', description: 'Código único interno GAFER' })
  codigoInterno!: string;

  @ApiProperty({ example: 'Nebulizadora ULV Vector Fog C-150', description: 'Nombre del equipo' })
  nombre!: string;

  @ApiProperty({ example: 'NEBULIZACION', enum: ['FUMIGACION', 'NEBULIZACION', 'ASPERSION', 'LIMPIEZA', 'MEDICION', 'PROTECCION', 'OTRO'] })
  tipo!: 'FUMIGACION' | 'NEBULIZACION' | 'ASPERSION' | 'LIMPIEZA' | 'MEDICION' | 'PROTECCION' | 'OTRO';

  @ApiProperty({ example: 'Vector Fog C-150', required: false })
  marcaModelo?: string;

  @ApiProperty({ example: 'OPERATIVO', enum: ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO'], required: false })
  estadoOperativo?: 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO';
}

export class CrearPersonalDto {
  @ApiProperty({ example: '45892312', description: 'DNI exacto de 8 dígitos' })
  dni!: string;

  @ApiProperty({ example: 'Juan', description: 'Nombres completos' })
  nombres!: string;

  @ApiProperty({ example: 'Perez Gomez', description: 'Apellidos completos' })
  apellidos!: string;

  @ApiProperty({ example: 'TECNICO_OPERADOR', enum: ['SUPERVISOR', 'TECNICO_OPERADOR'] })
  cargo!: 'SUPERVISOR' | 'TECNICO_OPERADOR';

  @ApiProperty({ example: '958123456', description: 'Teléfono celular' })
  telefono!: string;

  @ApiProperty({ example: 'JPEREZ', required: false, description: 'Nombre de usuario' })
  usuario?: string;
}

export class GenerarUploadUrlDto {
  @ApiProperty({ example: 'insumos/fichas/ficha-cipermetrina.pdf', description: 'Clave de destino en MinIO S3' })
  key!: string;

  @ApiProperty({ example: 'application/pdf', required: false })
  contentType?: string;
}

export class GenerarDownloadUrlDto {
  @ApiProperty({ example: 'insumos/fichas/ficha-cipermetrina.pdf', description: 'Clave del archivo en MinIO S3' })
  key!: string;
}

