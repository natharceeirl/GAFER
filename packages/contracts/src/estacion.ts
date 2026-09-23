import { z } from 'zod';

export const ColorAuraSchema = z.enum(['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO']);
export type ColorAura = z.infer<typeof ColorAuraSchema>;

export const ColorIconoSchema = z.enum(['VERDE', 'ROJO']);
export type ColorIcono = z.infer<typeof ColorIconoSchema>;

/** Spec Mapas §5.2 — determina la forma del ícono: círculo para cebo raticida, cuadrado para otro tipo de trampa. */
export const TipoEstacionSchema = z.enum(['CEBO_RATICIDA', 'TRAMPA_MECANICA']);
export type TipoEstacion = z.infer<typeof TipoEstacionSchema>;

export const EstacionSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int().positive(),
  tipoEstacion: TipoEstacionSchema,
  colorIcono: ColorIconoSchema,
  colorAura: ColorAuraSchema,
});
export type Estacion = z.infer<typeof EstacionSchema>;
