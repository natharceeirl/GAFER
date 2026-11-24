import { z } from 'zod';
import { EstadoActivoInactivoSchema } from './cliente';
import { MonedaSchema, MontoSchema, type Moneda } from './comun';

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
  proyectoId: z.string().uuid().describe('ID de la sede/proyecto'),
  tipoServicio: TipoServicioSchema.describe('Tipo de servicio (DSF, DSS, DRT, LRA, LTG, LTS, LAM)'),
  frecuencia: FrecuenciaServicioSchema.describe('Frecuencia con la que se repite el servicio'),
  areaTotalM2: z.number().positive().describe('Superficie total en m²'),
  areaTratarM2: z.number().positive().describe('Superficie efectiva a tratar en m²'),
  insumosAutorizados: z.array(z.string().uuid()).optional().describe('IDs de los insumos autorizados para el servicio'),
  equiposAutorizados: z.array(z.string().uuid()).optional().describe('IDs de los equipos autorizados para el servicio'),
  /** Dosis referencial por insumo, indexada por id de insumo. */
  dosisReferencial: z.record(z.string()).optional().describe('Dosis referencial por insumo, indexada por id de insumo'),
  requiereCertificado: z.boolean().optional().describe('Si emite certificado de saneamiento'),
  vigenciaDias: z.number().int().positive().nullish().describe('Vigencia del certificado en días (obligatoria si requiere certificado)'),
  monto: MontoSchema.nullish().describe('Monto pactado del servicio (opcional, GAF-105)'),
  moneda: MonedaSchema.nullish().describe('Moneda del monto pactado (PEN o USD, opcional, GAF-105)'),
});

interface ReglasServicio {
  areaTotalM2: number;
  areaTratarM2: number;
  requiereCertificado?: boolean;
  vigenciaDias?: number | null;
  monto?: number | null;
  moneda?: Moneda | null;
}

/** Reglas cruzadas del servicio: el área a tratar cabe en el local, el certificado exige vigencia y monto/moneda van en par. */
function aplicarReglasServicio(servicio: ReglasServicio, ctx: z.RefinementCtx): void {
  if (servicio.areaTratarM2 > servicio.areaTotalM2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['areaTratarM2'], message: 'No puede superar el área total del local' });
  }
  if (servicio.requiereCertificado && servicio.vigenciaDias == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vigenciaDias'], message: 'Un servicio con certificado requiere vigencia en días' });
  }
  const tieneMonto = servicio.monto != null;
  const tieneMoneda = servicio.moneda != null;
  if (tieneMonto && !tieneMoneda) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['moneda'], message: 'Debe indicar la moneda cuando ingresa un monto' });
  } else if (!tieneMonto && tieneMoneda) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['moneda'], message: 'No se puede especificar moneda sin un monto' });
  }
}

export const ServicioContratadoRegistroSchema = ServicioContratadoBaseSchema.superRefine(aplicarReglasServicio);
export type ServicioContratadoRegistro = z.infer<typeof ServicioContratadoRegistroSchema>;

export const ServicioContratadoDetalleSchema = ServicioContratadoBaseSchema.extend({
  id: z.string().uuid(),
  estado: EstadoActivoInactivoSchema,
}).superRefine(aplicarReglasServicio);
export type ServicioContratadoDetalle = z.infer<typeof ServicioContratadoDetalleSchema>;

/** Actualización parcial de un servicio contratado */
export const ServicioContratadoActualizacionSchema = z
  .object({
    frecuencia: FrecuenciaServicioSchema.optional().describe('Frecuencia con la que se repite el servicio'),
    areaTotalM2: z.number().positive().optional().describe('Superficie total en m²'),
    areaTratarM2: z.number().positive().optional().describe('Superficie efectiva a tratar en m²'),
    insumosAutorizados: z.array(z.string().uuid()).optional().describe('IDs de los insumos autorizados'),
    equiposAutorizados: z.array(z.string().uuid()).optional().describe('IDs de los equipos autorizados'),
    dosisReferencial: z.record(z.string()).optional().describe('Dosis referencial por insumo'),
    requiereCertificado: z.boolean().optional().describe('Si emite certificado de saneamiento'),
    vigenciaDias: z.number().int().positive().nullish().describe('Vigencia del certificado en días'),
    monto: MontoSchema.nullish().describe('Monto pactado del servicio (opcional, GAF-105)'),
    moneda: MonedaSchema.nullish().describe('Moneda del monto pactado (PEN o USD, opcional, GAF-105)'),
  })
  .superRefine((servicio, ctx) => {
    if (
      servicio.areaTotalM2 !== undefined &&
      servicio.areaTratarM2 !== undefined &&
      servicio.areaTratarM2 > servicio.areaTotalM2
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['areaTratarM2'],
        message: 'No puede superar el área total del local',
      });
    }
    if (servicio.requiereCertificado === true && servicio.vigenciaDias == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vigenciaDias'],
        message: 'Un servicio con certificado requiere vigencia en días',
      });
    }
    if (servicio.monto != null && servicio.moneda === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['moneda'],
        message: 'Debe indicar la moneda cuando ingresa un monto',
      });
    } else if (servicio.monto === null && servicio.moneda != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['moneda'],
        message: 'No se puede especificar moneda sin un monto',
      });
    }
  });
export type ServicioContratadoActualizacion = z.infer<typeof ServicioContratadoActualizacionSchema>;
