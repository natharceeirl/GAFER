import { z } from 'zod';
import { ColorAuraSchema, ColorIconoSchema } from './estacion';
import { PorcentajeConsumoSchema, EstadoFisicoEstacionSchema } from './inspeccion';
import { FechaSchema } from './comun';

export const TipoOperacionSyncSchema = z.enum([
  'REGISTRO_ESTACION',
  'ACTUALIZACION_ESTACION',
  'REGISTRO_OBSERVACIONES',
  'REGISTRO_SERVICIO_DRT',
  'REGISTRO_SERVICIO_CAMPO',
]);
export type TipoOperacionSync = z.infer<typeof TipoOperacionSyncSchema>;

export const PayloadEstacionSyncSchema = z.object({
  estacionId: z.string().uuid().optional(),
  numeroEstacion: z.number().int().positive(),
  huboConsumo: z.boolean().optional(),
  porcentajeConsumo: PorcentajeConsumoSchema.optional(),
  cantidadGramos: z.number().nonnegative().optional(),
  consumoGramos: z.number().nonnegative().optional(),
  cantidadReposicion: z.number().nonnegative().optional(),
  tipoCebo: z.string().optional(),
  lote: z.string().optional(),
  vencimiento: FechaSchema.optional(),
  estadoFisico: EstadoFisicoEstacionSchema.optional(),
  esInstalacion: z.boolean().optional(),
  colorIcono: ColorIconoSchema.optional(),
  colorAura: ColorAuraSchema.optional(),
  observaciones: z.string().optional(),
});
export type PayloadEstacionSync = z.infer<typeof PayloadEstacionSyncSchema>;

export const OperacionSyncSchema = z.object({
  operationId: z.string().uuid().describe('ID único de la operación, generado en el dispositivo (idempotencia)'),
  tipo: TipoOperacionSyncSchema.describe('Tipo de operación de campo'),
  agregadoId: z.string().uuid().describe('ID de la inspección a la que pertenece la operación'),
  actorId: z.string().uuid().describe('ID del personal técnico que la realizó'),
  clienteTimestamp: z.string().datetime().describe('Marca de tiempo ISO del dispositivo al registrar la operación'),
  payload: z.record(z.unknown()).describe('Datos de la operación; su forma depende del tipo'),
});
export type OperacionSync = z.infer<typeof OperacionSyncSchema>;

export const LoteSyncRequestSchema = z.object({
  inspeccionId: z.string().uuid().describe('ID de la inspección que se sincroniza'),
  operaciones: z.array(OperacionSyncSchema).min(1).describe('Operaciones pendientes, en el orden en que se registraron'),
});
export type LoteSyncRequest = z.infer<typeof LoteSyncRequestSchema>;

export const EstadoOperacionSyncSchema = z.enum([
  'PROCESADA',
  'IDEMPOTENTE_IGNORADA',
  'CONFLICTO_RESUELTO',
  'RECHAZADA',
]);
export type EstadoOperacionSync = z.infer<typeof EstadoOperacionSyncSchema>;

export const ConflictoSyncSchema = z.object({
  operationId: z.string().uuid(),
  motivo: z.string(),
  valorDesplazado: z.unknown().optional(),
});
export type ConflictoSync = z.infer<typeof ConflictoSyncSchema>;

export const LoteSyncResponseSchema = z.object({
  inspeccionId: z.string().uuid(),
  procesadas: z.array(z.string().uuid()),
  omitidasIdempotentes: z.array(z.string().uuid()),
  conflictos: z.array(ConflictoSyncSchema),
  serverReceivedAt: z.string().datetime(),
});
export type LoteSyncResponse = z.infer<typeof LoteSyncResponseSchema>;
