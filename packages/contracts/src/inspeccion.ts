import { z } from 'zod';
import { FechaSchema, HoraSchema } from './comun';

/** Spec §13 — ciclo de la inspección. ENVIADO pertenece solo al documento (ver `EstadoDocumentoSchema`). */
export const EstadoInspeccionSchema = z.enum(['BORRADOR', 'CERRADO', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO']);
export type EstadoInspeccion = z.infer<typeof EstadoInspeccionSchema>;

/** Spec Mapas §5.1 — porcentaje de cebo consumido, en pasos de 25. */
export const PorcentajeConsumoSchema = z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(100)]);
export type PorcentajeConsumo = z.infer<typeof PorcentajeConsumoSchema>;

export const EstadoFisicoEstacionSchema = z.enum(['BUENAS_CONDICIONES', 'MALAS_CONDICIONES']);
export type EstadoFisicoEstacion = z.infer<typeof EstadoFisicoEstacionSchema>;

/**
 * Spec Mapas §5.1 — lo que se registra de una estación en cada inspección.
 * Con consumo se suma la cantidad de reposición; sin consumo, la cantidad repuesta y el estado físico.
 */
export const InspeccionRegistradaSchema = z.object({
  fecha: FechaSchema,
  tipoCebo: z.string().min(1),
  cantidadGramos: z.number().nonnegative(),
  lote: z.string().min(1),
  vencimiento: FechaSchema,
  huboConsumo: z.boolean(),
  porcentajeConsumo: PorcentajeConsumoSchema.optional(),
  cantidadReposicion: z.number().nonnegative().optional(),
  estadoFisico: EstadoFisicoEstacionSchema.optional(),
  cantidadRepuesta: z.number().nonnegative().optional(),
});
export type InspeccionRegistrada = z.infer<typeof InspeccionRegistradaSchema>;

export const TecnicoParticipanteSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
});
export type TecnicoParticipante = z.infer<typeof TecnicoParticipanteSchema>;

export const InspeccionSchema = z.object({
  id: z.string().uuid(),
  servicioId: z.string().uuid(),
  codigoInspeccion: z.string().min(1),
  estado: EstadoInspeccionSchema,
  versionSync: z.number().int().min(1),
  fechaEjecucion: FechaSchema,
  horaInicio: HoraSchema.nullish(),
  horaFin: HoraSchema.nullish(),
  tecnicosParticipantes: z.array(TecnicoParticipanteSchema),
  /** Foto inmutable de catálogos e insumos al cerrar la inspección (Spec §13). */
  snapshotCatalogos: z.record(z.unknown()),
});
export type Inspeccion = z.infer<typeof InspeccionSchema>;

/** Insumo aplicado, tal como se declara al cerrar la inspección. */
export const ConsumoInsumoSchema = z.object({
  insumoId: z.string().uuid().describe('ID del insumo químico en catálogo'),
  dosisAplicada: z.string().min(1).describe('Dosis real aplicada en campo'),
  lote: z.string().min(1).describe('Número de lote del fabricante'),
  cantidadUtilizada: z.number().min(0.01).describe('Cantidad consumida'),
});
export type ConsumoInsumo = z.infer<typeof ConsumoInsumoSchema>;

export const CerrarInspeccionSchema = z.object({
  consumos: z.array(ConsumoInsumoSchema).optional().describe('Insumos químicos aplicados durante la inspección'),
  equiposIds: z.array(z.string().uuid()).optional().describe('IDs de equipos utilizados en campo'),
  personalIds: z.array(z.string().uuid()).optional().describe('IDs del personal técnico participante'),
});
export type CerrarInspeccion = z.infer<typeof CerrarInspeccionSchema>;

/** Apertura de una inspección en borrador para un servicio contratado. */
export const CrearInspeccionSchema = z.object({
  servicioId: z.string().uuid().describe('ID del servicio contratado'),
});
export type CrearInspeccion = z.infer<typeof CrearInspeccionSchema>;
