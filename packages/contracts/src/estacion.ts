import { z } from 'zod';

export const ColorAuraSchema = z.enum(['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO']);
export type ColorAura = z.infer<typeof ColorAuraSchema>;

export const ColorIconoSchema = z.enum(['VERDE', 'ROJO']);
export type ColorIcono = z.infer<typeof ColorIconoSchema>;

export const EstacionSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int().positive(),
  colorIcono: ColorIconoSchema,
  colorAura: ColorAuraSchema,
});
export type Estacion = z.infer<typeof EstacionSchema>;
