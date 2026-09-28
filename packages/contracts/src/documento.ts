import { z } from 'zod';
import { FechaSchema } from './comun';

export const EstadoDocumentoSchema = z.enum([
  'BORRADOR',
  'CERRADO',
  'ENVIADO_A_REVISION',
  'OBSERVADO',
  'APROBADO',
  'ENVIADO',
]);
export type EstadoDocumento = z.infer<typeof EstadoDocumentoSchema>;

export const TipoDocumentoSchema = z.enum(['INFORME', 'REPORTE']);
export type TipoDocumento = z.infer<typeof TipoDocumentoSchema>;

export const DocumentoSchema = z.object({
  id: z.string().uuid(),
  clienteId: z.string().uuid(),
  tipo: TipoDocumentoSchema,
  numeroCorrelativo: z.number().int().positive(),
  estado: EstadoDocumentoSchema,
});
export type Documento = z.infer<typeof DocumentoSchema>;

/** Fila de la bandeja de aprobación: nombres legibles en lugar de ids. */
export const DocumentoResumenSchema = z.object({
  id: z.string().min(1),
  codigo: z.string().min(1),
  cliente: z.string().min(1),
  proyecto: z.string().min(1),
  tipo: TipoDocumentoSchema,
  estado: EstadoDocumentoSchema,
  fecha: FechaSchema,
});
export type DocumentoResumen = z.infer<typeof DocumentoResumenSchema>;

export const InsumoUsadoSchema = z.object({
  producto: z.string(),
  lote: z.string(),
  cantidad: z.string(),
  concentracion: z.string(),
});
export type InsumoUsado = z.infer<typeof InsumoUsadoSchema>;

export const PersonalIntervinienteSchema = z.object({
  nombre: z.string(),
  cargo: z.string(),
});
export type PersonalInterviniente = z.infer<typeof PersonalIntervinienteSchema>;

export const DocumentoDetalleSchema = DocumentoResumenSchema.extend({
  diagnostico: z.string(),
  trabajosRealizados: z.string(),
  insumosUsados: z.array(InsumoUsadoSchema),
  personal: z.array(PersonalIntervinienteSchema),
  accionesCorrectivas: z.array(z.string()),
  observaciones: z.string(),
  recomendaciones: z.string(),
  fotos: z.number().int().nonnegative(),
  numeroCertificado: z.string(),
  vencimientoCertificado: z.string(),
  firmaCliente: z.string(),
  /** Sincronización en dos fases (C15): las fotos llegan después que los datos. */
  fotosRecibidas: z.number().int().nonnegative().optional(),
  fotosSeleccionadas: z.array(z.number().int().nonnegative()).optional(),
  comentarioObservacion: z.string().optional(),
  /** Al aprobar (C7, C13, C14). */
  firmaDirector: z.string().optional(),
  generados: z.array(z.string()).optional(),
  anexos: z.array(z.string()).optional(),
});
export type DocumentoDetalle = z.infer<typeof DocumentoDetalleSchema>;
