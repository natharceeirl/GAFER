import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class CrearClienteDto {
  @ApiProperty({ example: 'Kallpa Generacion S.A.', description: 'Razón social legal' })
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  razonSocial!: string;

  @ApiProperty({ example: '20508565434', description: 'RUC exacto de 11 dígitos' })
  @IsString()
  @Matches(/^[0-9]{11}$/, { message: 'El RUC debe tener exactamente 11 dígitos numéricos' })
  ruc!: string;

  @ApiProperty({ example: 'KALLPA', description: 'Código corto alfanumérico en mayúsculas (3-10 car.)' })
  @IsString()
  @Matches(/^[A-Z0-9_]{3,10}$/, {
    message: 'El código corto debe tener entre 3 y 10 caracteres alfanuméricos en mayúsculas (ej. KALLPA, SAMAY_1)',
  })
  codigoCorto!: string;

  @ApiProperty({ example: 'Av. Las Palmas 123, Mollendo', description: 'Dirección fiscal' })
  @IsString()
  @IsNotEmpty({ message: 'La dirección fiscal es obligatoria' })
  direccionFiscal!: string;

  @ApiProperty({ example: 'Generación Eléctrica', description: 'Giro de negocio' })
  @IsString()
  @IsNotEmpty({ message: 'El giro de negocio es obligatorio' })
  giroNegocio!: string;

  @ApiProperty({ example: 'Carlos Ramos', description: 'Persona de contacto' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del contacto es obligatorio' })
  contactoNombre!: string;

  @ApiProperty({ example: 'Jefe de SSOMA', description: 'Cargo del contacto' })
  @IsString()
  @IsNotEmpty({ message: 'El cargo del contacto es obligatorio' })
  contactoCargo!: string;

  @ApiProperty({ example: '958123456', description: 'Teléfono o celular' })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono de contacto es obligatorio' })
  contactoTelefono!: string;

  @ApiProperty({ example: 'cramos@kallpa.pe', description: 'Correo electrónico válido' })
  @IsEmail({}, { message: 'El correo de contacto debe ser un email válido' })
  contactoCorreo!: string;

  @ApiProperty({ example: {}, required: false, description: 'Campos personalizados extra' })
  @IsOptional()
  @IsObject()
  camposExtra?: Record<string, unknown>;
}

export class ActualizarClienteDto {
  @ApiProperty({ example: 'Kallpa Generacion S.A.C.', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  razonSocial?: string;

  @ApiProperty({ example: 'Av. Las Palmas 456, Mollendo', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  direccionFiscal?: string;

  @ApiProperty({ example: 'Generación Eléctrica y Térmica', required: false })
  @IsOptional()
  @IsString()
  giroNegocio?: string;

  @ApiProperty({ example: 'Carlos Ramos Mejia', required: false })
  @IsOptional()
  @IsString()
  contactoNombre?: string;

  @ApiProperty({ example: 'Gerente SSOMA', required: false })
  @IsOptional()
  @IsString()
  contactoCargo?: string;

  @ApiProperty({ example: '958999888', required: false })
  @IsOptional()
  @IsString()
  contactoTelefono?: string;

  @ApiProperty({ example: 'cramos_nuevo@kallpa.pe', required: false })
  @IsOptional()
  @IsEmail()
  contactoCorreo?: string;

  @ApiProperty({ example: {}, required: false })
  @IsOptional()
  @IsObject()
  camposExtra?: Record<string, unknown>;
}

export class CrearProyectoDto {
  @ApiProperty({ example: 'c1111111-1111-1111-1111-111111111111', description: 'ID del cliente propietario' })
  @IsUUID('all', { message: 'El clienteId debe ser un UUID válido' })
  clienteId!: string;

  @ApiProperty({ example: 'PLANTA_SUR', description: 'Nombre de la sede en mayúsculas y sin espacios' })
  @IsString()
  @Matches(/^[A-Z0-9_]{3,50}$/, {
    message: 'El nombre de la sede/proyecto debe tener entre 3 y 50 caracteres alfanuméricos en mayúsculas sin espacios (ej. PLANTA_SUR)',
  })
  nombre!: string;

  @ApiProperty({ example: 'Carretera Costanera Km 12', description: 'Dirección física de la sede' })
  @IsString()
  @IsNotEmpty({ message: 'La dirección física de la sede es obligatoria' })
  direccionSede!: string;

  @ApiProperty({ example: 'Mollendo', description: 'Distrito' })
  @IsString()
  @IsNotEmpty()
  distrito!: string;

  @ApiProperty({ example: 'Islay', description: 'Provincia' })
  @IsString()
  @IsNotEmpty()
  provincia!: string;

  @ApiProperty({ example: 'Arequipa', description: 'Departamento' })
  @IsString()
  @IsNotEmpty()
  departamento!: string;

  @ApiProperty({ example: 'Mario Vargas', description: 'Nombre del responsable en sede' })
  @IsString()
  @IsNotEmpty()
  contactoNombre!: string;

  @ApiProperty({ example: 'Supervisor de Planta', description: 'Cargo' })
  @IsString()
  @IsNotEmpty()
  contactoCargo!: string;

  @ApiProperty({ example: '954987654', description: 'Teléfono de la sede' })
  @IsString()
  @IsNotEmpty()
  contactoTelefono!: string;

  @ApiProperty({ example: 'Requerido pase médico y EPP', required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CrearServicioContratadoDto {
  @ApiProperty({ example: 'p1111111-1111-1111-1111-111111111111', description: 'ID de la sede/proyecto' })
  @IsUUID('all', { message: 'El proyectoId debe ser un UUID válido' })
  proyectoId!: string;

  @ApiProperty({
    example: 'DSF',
    enum: ['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM'],
    description: 'Tipo de servicio (DSF, DSS, DRT, LRA, LTG, LTS, LAM)',
  })
  @IsIn(['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM'], {
    message: 'El tipo de servicio debe ser uno de los 7 oficiales: DSF, DSS, DRT, LRA, LTG, LTS, LAM',
  })
  tipoServicio!: 'DSF' | 'DSS' | 'DRT' | 'LRA' | 'LTG' | 'LTS' | 'LAM';

  @ApiProperty({
    example: 'MENSUAL',
    enum: ['DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PUNTUAL'],
  })
  @IsIn(
    ['DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PUNTUAL'],
    { message: 'Frecuencia no válida' },
  )
  frecuencia!: 'DIARIA' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PUNTUAL';

  @ApiProperty({ example: 5000.5, description: 'Superficie total en m²' })
  @IsNumber()
  @Min(0.01, { message: 'El área total debe ser mayor a 0 m²' })
  areaTotalM2!: number;

  @ApiProperty({ example: 3500.0, description: 'Superficie efectiva a tratar en m²' })
  @IsNumber()
  @Min(0.01, { message: 'El área a tratar debe ser mayor a 0 m²' })
  areaTratarM2!: number;

  @ApiProperty({ example: true, description: 'Si emite certificado de saneamiento' })
  @IsBoolean()
  requiereCertificado!: boolean;

  @ApiProperty({ example: 30, required: false, description: 'Vigencia del certificado en días' })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La vigencia del certificado debe ser al menos de 1 día' })
  vigenciaDias?: number;
}

export class CrearInsumoDto {
  @ApiProperty({ example: 'Cipermetrina 25%', description: 'Nombre comercial' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre comercial del insumo es obligatorio' })
  nombreComercial!: string;

  @ApiProperty({ example: 'Cipermetrina', description: 'Principio activo' })
  @IsString()
  @IsNotEmpty({ message: 'El principio activo es obligatorio' })
  principioActivo!: string;

  @ApiProperty({ example: 'LIQUIDO', enum: ['LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO'] })
  @IsIn(['LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO'])
  presentacion!: 'LIQUIDO' | 'POLVO' | 'BLOQUE' | 'SOBRE' | 'GEL' | 'OTRO';

  @ApiProperty({ example: 'L', enum: ['ML', 'L', 'G', 'KG', 'SOBRE', 'BLOQUE', 'UNIDAD'] })
  @IsIn(['ML', 'L', 'G', 'KG', 'SOBRE', 'BLOQUE', 'UNIDAD'])
  unidadMedida!: 'ML' | 'L' | 'G' | 'KG' | 'SOBRE' | 'BLOQUE' | 'UNIDAD';

  @ApiProperty({ example: 'RD-1425-2024/DIGESA/SA', description: 'Registro DIGESA oficial' })
  @IsString()
  @IsNotEmpty({ message: 'El registro DIGESA es obligatorio' })
  registroDigesa!: string;

  @ApiProperty({ example: '25% p/v', description: 'Concentración' })
  @IsString()
  @IsNotEmpty()
  concentracion!: string;

  @ApiProperty({ example: '5 ml / Litro de agua', description: 'Dosis estándar' })
  @IsString()
  @IsNotEmpty()
  dosisEstandar!: string;

  @ApiProperty({ example: 'insumos/fichas/cipermetrina-25.pdf', description: 'Key en MinIO S3' })
  @IsString()
  @IsNotEmpty({ message: 'La clave de ficha técnica en MinIO S3 es obligatoria' })
  fichaTecnicaKey!: string;

  @ApiProperty({ example: 'insumos/msds/cipermetrina-25.pdf', description: 'Key en MinIO S3' })
  @IsString()
  @IsNotEmpty({ message: 'La clave de hoja MSDS en MinIO S3 es obligatoria' })
  hojaMsdsKey!: string;

  @ApiProperty({ example: 'insumos/resoluciones/rd-1425.pdf', required: false })
  @IsOptional()
  @IsString()
  resolucionKey?: string;

  @ApiProperty({ example: 'Bayer S.A.', required: false })
  @IsOptional()
  @IsString()
  proveedor?: string;
}

export class ActualizarInsumoDto {
  @ApiProperty({ example: 'Cipermetrina 50% Ultra Concentrada (REFORMULADO 2028)', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre comercial no puede estar vacío' })
  nombreComercial?: string;

  @ApiProperty({ example: 'Cipermetrina Pura', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  principioActivo?: string;

  @ApiProperty({ example: 'LIQUIDO', enum: ['LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO'], required: false })
  @IsOptional()
  @IsIn(['LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO'])
  presentacion?: 'LIQUIDO' | 'POLVO' | 'BLOQUE' | 'SOBRE' | 'GEL' | 'OTRO';

  @ApiProperty({ example: 'L', enum: ['ML', 'L', 'G', 'KG', 'SOBRE', 'BLOQUE', 'UNIDAD'], required: false })
  @IsOptional()
  @IsIn(['ML', 'L', 'G', 'KG', 'SOBRE', 'BLOQUE', 'UNIDAD'])
  unidadMedida?: 'ML' | 'L' | 'G' | 'KG' | 'SOBRE' | 'BLOQUE' | 'UNIDAD';

  @ApiProperty({ example: 'RD-9999-2028/DIGESA/SA', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El registro DIGESA no puede estar vacío' })
  registroDigesa?: string;

  @ApiProperty({ example: '50% p/v', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  concentracion?: string;

  @ApiProperty({ example: '2.5 ml/L', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dosisEstandar?: string;

  @ApiProperty({ example: 'insumos/fichas/cipermetrina-50.pdf', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fichaTecnicaKey?: string;

  @ApiProperty({ example: 'insumos/msds/cipermetrina-50.pdf', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  hojaMsdsKey?: string;

  @ApiProperty({ example: 'insumos/resoluciones/rd-9999.pdf', required: false })
  @IsOptional()
  @IsString()
  resolucionKey?: string;

  @ApiProperty({ example: 'Bayer S.A.', required: false })
  @IsOptional()
  @IsString()
  proveedor?: string;
}

export class CrearEquipoDto {
  @ApiProperty({ example: 'EQ-NEB-01', description: 'Código único interno GAFER' })
  @IsString()
  @IsNotEmpty({ message: 'El código interno del equipo es obligatorio' })
  codigoInterno!: string;

  @ApiProperty({ example: 'Nebulizadora ULV Vector Fog C-150', description: 'Nombre del equipo' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del equipo es obligatorio' })
  nombre!: string;

  @ApiProperty({
    example: 'NEBULIZACION',
    enum: ['FUMIGACION', 'NEBULIZACION', 'ASPERSION', 'LIMPIEZA', 'MEDICION', 'PROTECCION', 'OTRO'],
  })
  @IsIn(['FUMIGACION', 'NEBULIZACION', 'ASPERSION', 'LIMPIEZA', 'MEDICION', 'PROTECCION', 'OTRO'])
  tipo!: 'FUMIGACION' | 'NEBULIZACION' | 'ASPERSION' | 'LIMPIEZA' | 'MEDICION' | 'PROTECCION' | 'OTRO';

  @ApiProperty({ example: 'Vector Fog C-150', required: false })
  @IsOptional()
  @IsString()
  marcaModelo?: string;

  @ApiProperty({ example: 'OPERATIVO', enum: ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO'], required: false })
  @IsOptional()
  @IsIn(['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO'])
  estadoOperativo?: 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO';
}

export class CambiarEstadoEquipoDto {
  @ApiProperty({ example: 'MANTENIMIENTO', enum: ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO'] })
  @IsIn(['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO'], {
    message: 'El estado debe ser OPERATIVO, MANTENIMIENTO o FUERA_SERVICIO',
  })
  estadoOperativo!: 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO';
}

export class CrearPersonalDto {
  @ApiProperty({ example: '45892312', description: 'DNI exacto de 8 dígitos' })
  @IsString()
  @Matches(/^[0-9]{8}$/, { message: 'El DNI debe contener exactamente 8 dígitos numéricos' })
  dni!: string;

  @ApiProperty({ example: 'Juan', description: 'Nombres completos' })
  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  nombres!: string;

  @ApiProperty({ example: 'Perez Gomez', description: 'Apellidos completos' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  apellidos!: string;

  @ApiProperty({ example: 'TECNICO_OPERADOR', enum: ['SUPERVISOR', 'TECNICO_OPERADOR'] })
  @IsIn(['SUPERVISOR', 'TECNICO_OPERADOR'], {
    message: 'El cargo debe ser SUPERVISOR o TECNICO_OPERADOR',
  })
  cargo!: 'SUPERVISOR' | 'TECNICO_OPERADOR';

  @ApiProperty({ example: '958123456', description: 'Teléfono celular' })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  telefono!: string;

  @ApiProperty({ example: 'JPEREZ', required: false, description: 'Nombre de usuario' })
  @IsOptional()
  @IsString()
  usuario?: string;
}

export class GenerarUploadUrlDto {
  @ApiProperty({ example: 'insumos/fichas/ficha-cipermetrina.pdf', description: 'Clave de destino en MinIO S3' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'application/pdf', required: false })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class GenerarDownloadUrlDto {
  @ApiProperty({ example: 'insumos/fichas/ficha-cipermetrina.pdf', description: 'Clave del archivo en MinIO S3' })
  @IsString()
  @IsNotEmpty()
  key!: string;
}
