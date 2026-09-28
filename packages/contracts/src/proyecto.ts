import { z } from 'zod';
import { TelefonoSchema } from './comun';
import { EstadoActivoInactivoSchema } from './cliente';

export const ProyectoSchema = z.object({
  id: z.string().uuid(),
  clienteId: z.string().uuid(),
  nombre: z.string().min(4).max(20),
  direccion: z.string().min(1),
  estado: EstadoActivoInactivoSchema,
});
export type Proyecto = z.infer<typeof ProyectoSchema>;

/** Spec §7.2 — sede física de un cliente; el nombre va en mayúsculas, sin espacios, de 4 a 20 caracteres. */
export const ProyectoRegistroSchema = z.object({
  clienteId: z.string().uuid(),
  nombre: z.string().regex(/^[A-Z0-9_]{4,20}$/, 'De 4 a 20 caracteres en mayúsculas, sin espacios (ej. PLANTA, CSF_SUNNY)'),
  direccionSede: z.string().min(1),
  distrito: z.string().min(1),
  provincia: z.string().min(1),
  departamento: z.string().min(1),
  contactoNombre: z.string().min(1),
  contactoCargo: z.string().min(1),
  contactoTelefono: TelefonoSchema,
  observaciones: z.string().nullish(),
});
export type ProyectoRegistro = z.infer<typeof ProyectoRegistroSchema>;

/** Sede persistida: la base de datos admite nombres de 3 a 50 caracteres. */
export const ProyectoDetalleSchema = ProyectoRegistroSchema.extend({
  id: z.string().uuid(),
  nombre: z.string().regex(/^[A-Z0-9_]{3,50}$/),
  estado: EstadoActivoInactivoSchema,
});
export type ProyectoDetalle = z.infer<typeof ProyectoDetalleSchema>;
