import { ApiProperty } from '@nestjs/swagger';

export class InsumoSnapshotItemDto {
  @ApiProperty({ example: 'i1111111-1111-1111-1111-111111111111' })
  insumoId!: string;

  @ApiProperty({ example: 'Cipermetrina 25% CE' })
  nombreHistorico!: string;

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

  @ApiProperty({ example: '5 ml/L' })
  dosisAplicada!: string;

  @ApiProperty({ example: 'LOTE-2026-X' })
  lote!: string;

  @ApiProperty({ example: 1.5 })
  cantidadUtilizada!: number;

  @ApiProperty({ example: '2026-09-19T19:00:00.000Z' })
  congeladoEn!: string;
}

export class SnapshotCatalogosDto {
  @ApiProperty({ type: [InsumoSnapshotItemDto] })
  insumos!: InsumoSnapshotItemDto[];

  @ApiProperty({ example: '2026-09-19T19:00:00.000Z' })
  fechaCierre!: string;
}

export class InspeccionResponseDto {
  @ApiProperty({ example: 'insp-1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 's1111111-1111-1111-1111-111111111111' })
  servicioId!: string;

  @ApiProperty({ example: 'GAFER-2026-KALLPA-001' })
  codigoInspeccion!: string;

  @ApiProperty({ example: 'BORRADOR', enum: ['BORRADOR', 'CERRADO', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO'] })
  estado!: string;

  @ApiProperty({ example: 1, description: 'Versión de concurrencia y sincronización offline' })
  versionSync!: number;
}

export class InspeccionCerradaResponseDto {
  @ApiProperty({ example: 'insp-1111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'CERRADO' })
  estado!: string;

  @ApiProperty({ example: 2 })
  versionSync!: number;

  @ApiProperty({ type: SnapshotCatalogosDto, description: 'Copia inmutable de los catálogos al momento del cierre (Sección 13)' })
  snapshotCatalogos!: SnapshotCatalogosDto;
}
