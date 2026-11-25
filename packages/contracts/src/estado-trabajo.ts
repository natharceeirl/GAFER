import { z } from 'zod';

/**
 * Estado guardado del trabajo de un servicio contratado (GAF-99). Es independiente de la baja lógica
 * (`estado` ACTIVO / INACTIVO). Los valores son los que confirmó GAFER: Programado, Ejecutado, Concluido
 * y (aquí también) Cancelado. "Pendiente" NO se guarda: se deriva (ver `estadoVisibleDeServicio`).
 */
export const EstadoTrabajoSchema = z.enum(['PROGRAMADO', 'EJECUTADO', 'CONCLUIDO', 'CANCELADO']);
export type EstadoTrabajo = z.infer<typeof EstadoTrabajoSchema>;

/** Estado que se muestra: los guardados más PENDIENTE (programado cuya fecha ya pasó y no se ejecutó). */
export const EstadoVisibleTrabajoSchema = z.enum(['PROGRAMADO', 'PENDIENTE', 'EJECUTADO', 'CONCLUIDO', 'CANCELADO']);
export type EstadoVisibleTrabajo = z.infer<typeof EstadoVisibleTrabajoSchema>;

/** Fecha programada del servicio, YYYY-MM-DD. */
export const FechaProgramadaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener el formato AAAA-MM-DD');

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
 * Estado visible de un servicio: PENDIENTE = está PROGRAMADO y su fecha programada es anterior a hoy
 * (formato YYYY-MM-DD, comparable como texto). Sin fecha programada no puede vencerse.
 */
export function estadoVisibleDeServicio(
  estado: EstadoTrabajo,
  fechaProgramada: string | null | undefined,
  hoy: string,
): EstadoVisibleTrabajo {
  if (estado === 'PROGRAMADO' && fechaProgramada != null && fechaProgramada < hoy) return 'PENDIENTE';
  return estado;
}

/**
 * Estado de la sede calculado a partir de sus servicios (no se guarda). Acepta estados visibles:
 * - sin servicios: ninguno (null);
 * - algún servicio ejecutado, o trabajo concluido junto a trabajo por hacer: EJECUTADO;
 * - todos terminados (concluidos o cancelados) con al menos uno concluido: CONCLUIDO;
 * - todos cancelados: CANCELADO;
 * - el resto (por hacer, quizá con cancelados): PENDIENTE si alguno está vencido, si no PROGRAMADO.
 */
export function estadoTrabajoDeSede(estados: readonly EstadoVisibleTrabajo[]): EstadoVisibleTrabajo | null {
  if (estados.length === 0) return null;
  const hay = (estado: EstadoVisibleTrabajo) => estados.includes(estado);
  const porHacer = hay('PROGRAMADO') || hay('PENDIENTE');
  if (hay('EJECUTADO')) return 'EJECUTADO';
  if (hay('CONCLUIDO')) return porHacer ? 'EJECUTADO' : 'CONCLUIDO';
  if (hay('PENDIENTE')) return 'PENDIENTE';
  if (hay('PROGRAMADO')) return 'PROGRAMADO';
  return 'CANCELADO';
}
