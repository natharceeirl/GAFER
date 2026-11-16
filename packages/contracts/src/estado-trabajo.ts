import { z } from 'zod';

/**
 * Estado del trabajo de un servicio contratado (GAF-99). Es independiente de la baja lógica
 * (`estado` ACTIVO / INACTIVO): un servicio activo puede estar pendiente, en curso, completado o cancelado.
 * Los cuatro valores son un supuesto pendiente de confirmar con GAFER; este enum es el único lugar que los define.
 */
export const EstadoTrabajoSchema = z.enum(['PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO']);
export type EstadoTrabajo = z.infer<typeof EstadoTrabajoSchema>;

/** Largo mínimo del motivo que exigen la cancelación y la reapertura. */
export const MOTIVO_MINIMO_CARACTERES = 5;

/** Cuerpo de `PATCH /mantenimiento/servicios-contratados/:id/estado`. Las reglas de transición viven en el dominio del servidor. */
export const CambioEstadoTrabajoSchema = z
  .object({
    estado: EstadoTrabajoSchema.describe('Nuevo estado de trabajo del servicio'),
    motivo: z
      .string()
      .trim()
      .min(MOTIVO_MINIMO_CARACTERES, `El motivo debe tener al menos ${MOTIVO_MINIMO_CARACTERES} caracteres`)
      .optional()
      .describe('Motivo del cambio; obligatorio al cancelar y al reabrir'),
  })
  .superRefine((cambio, ctx) => {
    if (cambio.estado === 'CANCELADO' && cambio.motivo === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'El motivo es obligatorio para cancelar el servicio' });
    }
  });
export type CambioEstadoTrabajo = z.infer<typeof CambioEstadoTrabajoSchema>;

/**
 * Estado de la sede calculado a partir de sus servicios (no se guarda):
 * - sin servicios: ninguno (null);
 * - algún servicio en curso, o trabajo terminado junto a trabajo pendiente: EN_CURSO;
 * - todos terminados (completados o cancelados) con al menos uno completado: COMPLETADO;
 * - todos cancelados: CANCELADO;
 * - el resto (pendientes, quizá con cancelados): PENDIENTE.
 */
export function estadoTrabajoDeSede(estados: readonly EstadoTrabajo[]): EstadoTrabajo | null {
  if (estados.length === 0) return null;
  const hay = (estado: EstadoTrabajo) => estados.includes(estado);
  if (hay('EN_CURSO')) return 'EN_CURSO';
  if (hay('COMPLETADO')) return hay('PENDIENTE') ? 'EN_CURSO' : 'COMPLETADO';
  if (hay('PENDIENTE')) return 'PENDIENTE';
  return 'CANCELADO';
}
