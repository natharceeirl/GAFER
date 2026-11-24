import { z } from 'zod';
import { TelefonoSchema, MonedaSchema, MontoSchema, type Moneda } from './comun';
import { EstadoActivoInactivoSchema } from './cliente';

export const ProyectoSchema = z.object({
  id: z.string().uuid(),
  clienteId: z.string().uuid(),
  nombre: z.string().min(4).max(20),
  direccion: z.string().min(1),
  estado: EstadoActivoInactivoSchema,
});
export type Proyecto = z.infer<typeof ProyectoSchema>;

const ProyectoRegistroBaseSchema = z.object({
  clienteId: z.string().uuid().describe('ID del cliente propietario'),
  nombre: z
    .string()
    .regex(/^[A-Z0-9_]{4,20}$/, 'De 4 a 20 caracteres en mayúsculas, sin espacios (ej. PLANTA, CSF_SUNNY)')
    .describe('Nombre de la sede en mayúsculas y sin espacios (4 a 20 caracteres)'),
  direccionSede: z.string().min(1).describe('Dirección física de la sede'),
  distrito: z.string().min(1).describe('Distrito'),
  provincia: z.string().min(1).describe('Provincia'),
  departamento: z.string().min(1).describe('Departamento'),
  contactoNombre: z.string().min(1).describe('Nombre del responsable en sede'),
  contactoCargo: z.string().min(1).describe('Cargo del responsable en sede'),
  contactoTelefono: TelefonoSchema.describe('Teléfono de la sede'),
  observaciones: z.string().nullish().describe('Observaciones de acceso o seguridad de la sede'),
  montoPresupuestado: MontoSchema.nullish().describe('Monto presupuestado de la sede/proyecto (opcional, GAF-105)'),
  moneda: MonedaSchema.nullish().describe('Moneda del presupuesto (PEN o USD, opcional, GAF-105)'),
});

interface ReglasMontoProyecto {
  montoPresupuestado?: number | null;
  moneda?: Moneda | null;
}

function aplicarReglasMontoProyecto(proyecto: ReglasMontoProyecto, ctx: z.RefinementCtx): void {
  const tieneMonto = proyecto.montoPresupuestado != null;
  const tieneMoneda = proyecto.moneda != null;
  if (tieneMonto && !tieneMoneda) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['moneda'],
      message: 'Debe indicar la moneda cuando ingresa un presupuesto',
    });
  } else if (!tieneMonto && tieneMoneda) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['moneda'],
      message: 'No se puede especificar moneda sin un presupuesto',
    });
  }
}

/** Spec §7.2 — sede física de un cliente; el nombre va en mayúsculas, sin espacios, de 4 a 20 caracteres. */
export const ProyectoRegistroSchema = ProyectoRegistroBaseSchema.superRefine(aplicarReglasMontoProyecto);
export type ProyectoRegistro = z.infer<typeof ProyectoRegistroSchema>;

/** Sede persistida: la base de datos admite nombres de 3 a 50 caracteres. */
export const ProyectoDetalleSchema = ProyectoRegistroBaseSchema.extend({
  id: z.string().uuid(),
  nombre: z.string().regex(/^[A-Z0-9_]{3,50}$/),
  estado: EstadoActivoInactivoSchema,
}).superRefine(aplicarReglasMontoProyecto);
export type ProyectoDetalle = z.infer<typeof ProyectoDetalleSchema>;

/** Actualización parcial de una sede física */
export const ProyectoActualizacionSchema = z
  .object({
    nombre: z
      .string()
      .regex(/^[A-Z0-9_]{3,50}$/, 'De 3 a 50 caracteres en mayúsculas, sin espacios (ej. PLANTA, CSF_SUNNY)')
      .optional()
      .describe('Nombre de la sede en mayúsculas y sin espacios (3 a 50 caracteres)'),
    direccionSede: z.string().min(1).optional().describe('Dirección física de la sede'),
    distrito: z.string().min(1).optional().describe('Distrito'),
    provincia: z.string().min(1).optional().describe('Provincia'),
    departamento: z.string().min(1).optional().describe('Departamento'),
    contactoNombre: z.string().min(1).optional().describe('Nombre del responsable en sede'),
    contactoCargo: z.string().min(1).optional().describe('Cargo del responsable en sede'),
    contactoTelefono: TelefonoSchema.optional().describe('Teléfono de la sede'),
    observaciones: z.string().nullish().describe('Observaciones de acceso o seguridad de la sede'),
    montoPresupuestado: MontoSchema.nullish().describe('Monto presupuestado de la sede/proyecto (opcional, GAF-105)'),
    moneda: MonedaSchema.nullish().describe('Moneda del presupuesto (PEN o USD, opcional, GAF-105)'),
  })
  .superRefine((proyecto, ctx) => {
    if (proyecto.montoPresupuestado != null && proyecto.moneda === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['moneda'],
        message: 'Debe indicar la moneda cuando ingresa un presupuesto',
      });
    } else if (proyecto.montoPresupuestado === null && proyecto.moneda != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['moneda'],
        message: 'No se puede especificar moneda sin un presupuesto',
      });
    }
  });
export type ProyectoActualizacion = z.infer<typeof ProyectoActualizacionSchema>;
