import { z } from 'zod';
import { ColorAuraSchema, ColorIconoSchema } from './estacion';

export const TipoOperacionSyncSchema = z.enum([
  'REGISTRO_ESTACION',
  'ACTUALIZACION_ESTACION',
  'REGISTRO_OBSERVACIONES',
]);
export type TipoOperacionSync = z.infer<typeof TipoOperacionSyncSchema>;

export const PayloadEstacionSyncSchema = z.object({
  estacionId: z.string().uuid(),
  numeroEstacion: z.number().int().positive(),
  huboConsumo: z.boolean().optional(),
  colorIcono: ColorIconoSchema.optional(),
  colorAura: ColorAuraSchema.optional(),
  observaciones: z.string().optional(),
});
export type PayloadEstacionSync = z.infer<typeof PayloadEstacionSyncSchema>;

export const OperacionSyncSchema = z.object({
  operationId: z.string().uuid(),
  tipo: TipoOperacionSyncSchema,
  agregadoId: z.string().uuid(), // ID de la inspección
  actorId: z.string().uuid(), // ID de personal técnico
  clienteTimestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
});
export type OperacionSync = z.infer<typeof OperacionSyncSchema>;

export const LoteSyncRequestSchema = z.object({
  inspeccionId: z.string().uuid(),
  operaciones: z.array(OperacionSyncSchema).min(1),
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
