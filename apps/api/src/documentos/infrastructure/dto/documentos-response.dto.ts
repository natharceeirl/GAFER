import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoDocumentoSchema, TipoDocumentoSchema } from '@gafer/contracts';

const ESTADOS = EstadoDocumentoSchema.options;
const TIPOS = [...TipoDocumentoSchema.options, 'CERTIFICADO'];

export class DocumentoCreadoResponseDto {
  @ApiProperty({ example: 'd1111111-1111-4111-8111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'INFORME-KALLPA-014-2026', description: 'TIPO-CLIENTE-N°-AÑO; el año es solo una etiqueta' })
  codigo!: string;

  @ApiProperty({ enum: TIPOS, example: 'INFORME' })
  tipo!: string;

  @ApiProperty({ example: 14, description: 'Correlativo por cliente y tipo; nunca se reinicia por año' })
  numeroCorrelativo!: number;

  @ApiProperty({ enum: ESTADOS, example: 'BORRADOR' })
  estado!: string;
}

export class DocumentoTransicionadoResponseDto {
  @ApiProperty({ example: 'd1111111-1111-4111-8111-111111111111' })
  id!: string;

  @ApiProperty({ enum: ESTADOS, example: 'CERRADO' })
  estado!: string;
}

export class DocumentoResumenResponseDto {
  @ApiProperty({ example: 'd1111111-1111-4111-8111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'INFORME-KALLPA-014-2026' })
  codigo!: string;

  @ApiProperty({ example: 'a1111111-1111-4111-8111-111111111111' })
  clienteId!: string;

  @ApiProperty({ example: 'Kallpa Generación S.A.', description: 'Razón social del cliente' })
  cliente!: string;

  @ApiProperty({ example: 'PLANTA', nullable: true, type: String, description: 'Sede o proyecto, si el documento tiene uno' })
  proyecto!: string | null;

  @ApiProperty({ enum: TIPOS, example: 'INFORME' })
  tipo!: string;

  @ApiProperty({ example: 14 })
  numeroCorrelativo!: number;

  @ApiProperty({ enum: ESTADOS, example: 'ENVIADO_A_REVISION' })
  estado!: string;

  @ApiProperty({ example: '2026-11-24', description: 'AAAA-MM-DD, hora de Lima' })
  fecha!: string;
}

export class TransicionDocumentoResponseDto {
  @ApiPropertyOptional({ enum: ESTADOS, nullable: true, example: 'BORRADOR', description: 'Nulo en la creación del documento' })
  estadoAnterior!: string | null;

  @ApiProperty({ enum: ESTADOS, example: 'CERRADO' })
  estadoNuevo!: string;

  @ApiProperty({ example: 'c1111111-1111-4111-8111-111111111111', nullable: true, type: String })
  actorId!: string | null;

  @ApiProperty({ example: 'SUP.UNO' })
  actorUsuario!: string;

  @ApiProperty({ example: 'SUPERVISOR' })
  actorRol!: string;

  @ApiProperty({ example: 'Documento listo para revisión', nullable: true, type: String })
  motivo!: string | null;

  @ApiProperty({ example: '2026-11-24T15:00:00.000Z' })
  fecha!: string;
}

export class DocumentoDetalleResponseDto extends DocumentoResumenResponseDto {
  @ApiProperty({ type: [TransicionDocumentoResponseDto], description: 'Historial en orden cronológico' })
  transiciones!: TransicionDocumentoResponseDto[];
}
