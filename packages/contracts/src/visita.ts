import { z } from 'zod';
import { FechaSchema, HoraSchema } from './comun';

/** Estado de la visita según lo que va llegando desde la app de los técnicos. */
export const EstadoCampoSchema = z.enum(['PENDIENTE', 'EN_CURSO', 'EN_REVISION']);
export type EstadoCampo = z.infer<typeof EstadoCampoSchema>;

/**
 * Spec §8.1 — visita programada. Modelo híbrido (decisión C12): el técnico titular
 * es opcional y solo ordena su agenda; cualquier técnico activo puede atenderla.
 */
export const VisitaProgramadaSchema = z.object({
  id: z.string().uuid(),
  fecha: FechaSchema,
  hora: HoraSchema,
  clienteId: z.string().uuid(),
  proyectoId: z.string().uuid(),
  servicioId: z.string().uuid(),
  tecnicoTitularId: z.string().uuid().nullable(),
  observaciones: z.string(),
  estadoCampo: EstadoCampoSchema,
});
export type VisitaProgramada = z.infer<typeof VisitaProgramadaSchema>;
