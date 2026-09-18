import { z } from 'zod';

export const EstadoActivoInactivoSchema = z.enum(['ACTIVO', 'INACTIVO']);
export type EstadoActivoInactivo = z.infer<typeof EstadoActivoInactivoSchema>;

export const ClienteSchema = z.object({
  id: z.string().uuid(),
  codigoCorto: z
    .string()
    .min(4)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'El código corto debe estar en mayúsculas (ej. KALLPA, SAMAY)'),
  razonSocial: z.string().min(1),
  rucODni: z.string().min(1),
  estado: EstadoActivoInactivoSchema,
});
export type Cliente = z.infer<typeof ClienteSchema>;

export const ProyectoSchema = z.object({
  id: z.string().uuid(),
  clienteId: z.string().uuid(),
  nombre: z.string().min(4).max(20),
  direccion: z.string().min(1),
  estado: EstadoActivoInactivoSchema,
});
export type Proyecto = z.infer<typeof ProyectoSchema>;
