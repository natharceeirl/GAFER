import { z } from 'zod';
import { EstadoActivoInactivoSchema } from './cliente';

export const TipoServicioSchema = z.enum(['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM']);
export type TipoServicio = z.infer<typeof TipoServicioSchema>;

export const ServicioSchema = z.object({
  id: z.string().uuid(),
  proyectoId: z.string().uuid(),
  tipo: TipoServicioSchema,
  estado: EstadoActivoInactivoSchema,
});
export type Servicio = z.infer<typeof ServicioSchema>;

/** Spec §7.3 — frecuencia del servicio; en pantalla se muestra capitalizada (ej. "Quincenal"). */
export const FrecuenciaServicioSchema = z.enum([
  'DIARIA',
  'SEMANAL',
  'QUINCENAL',
  'MENSUAL',
  'BIMESTRAL',
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
  'PUNTUAL',
]);
export type FrecuenciaServicio = z.infer<typeof FrecuenciaServicioSchema>;

const ServicioContratadoBaseSchema = z.object({
  proyectoId: z.string().uuid(),
  tipoServicio: TipoServicioSchema,
  frecuencia: FrecuenciaServicioSchema,
  areaTotalM2: z.number().positive(),
  areaTratarM2: z.number().positive(),
  insumosAutorizados: z.array(z.string().uuid()).optional(),
  equiposAutorizados: z.array(z.string().uuid()).optional(),
  /** Dosis referencial por insumo, indexada por id de insumo. */
  dosisReferencial: z.record(z.string()).optional(),
  requiereCertificado: z.boolean().optional(),
  vigenciaDias: z.number().int().positive().nullish(),
});

interface ReglasServicio {
  areaTotalM2: number;
  areaTratarM2: number;
  requiereCertificado?: boolean;
  vigenciaDias?: number | null;
}

/** Reglas cruzadas del servicio: el área a tratar cabe en el local y el certificado exige vigencia (un valor no positivo ya lo rechaza el campo). */
function aplicarReglasServicio(servicio: ReglasServicio, ctx: z.RefinementCtx): void {
  if (servicio.areaTratarM2 > servicio.areaTotalM2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['areaTratarM2'], message: 'No puede superar el área total del local' });
  }
  if (servicio.requiereCertificado && servicio.vigenciaDias == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vigenciaDias'], message: 'Un servicio con certificado requiere vigencia en días' });
  }
}

export const ServicioContratadoRegistroSchema = ServicioContratadoBaseSchema.superRefine(aplicarReglasServicio);
export type ServicioContratadoRegistro = z.infer<typeof ServicioContratadoRegistroSchema>;

export const ServicioContratadoDetalleSchema = ServicioContratadoBaseSchema.extend({
  id: z.string().uuid(),
  estado: EstadoActivoInactivoSchema,
}).superRefine(aplicarReglasServicio);
export type ServicioContratadoDetalle = z.infer<typeof ServicioContratadoDetalleSchema>;
