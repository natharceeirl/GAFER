import { z } from 'zod';
import { RucSchema, TelefonoSchema } from './comun';

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

/** Spec §7.1 — datos que se aceptan al registrar un cliente: código de 4 a 10 letras o números en mayúsculas. */
export const ClienteRegistroSchema = z.object({
  razonSocial: z.string().min(1).describe('Razón social legal'),
  ruc: RucSchema.describe('RUC exacto de 11 dígitos'),
  codigoCorto: z
    .string()
    .regex(/^[A-Z0-9]{4,10}$/, 'De 4 a 10 letras o números en mayúsculas, sin espacios ni símbolos')
    .describe('Código corto alfanumérico en mayúsculas (4 a 10 caracteres)'),
  direccionFiscal: z.string().min(1).describe('Dirección fiscal'),
  giroNegocio: z.string().min(1).describe('Giro de negocio'),
  contactoNombre: z.string().min(1).describe('Persona de contacto'),
  contactoCargo: z.string().min(1).describe('Cargo del contacto'),
  contactoTelefono: TelefonoSchema.describe('Teléfono o celular'),
  contactoCorreo: z.string().email().describe('Correo electrónico válido'),
  camposExtra: z.record(z.unknown()).optional().describe('Campos personalizados extra'),
});
export type ClienteRegistro = z.infer<typeof ClienteRegistroSchema>;

/** Datos que se pueden corregir de un cliente ya registrado: todos opcionales, salvo el RUC y el código corto, que no cambian. */
export const ClienteActualizacionSchema = ClienteRegistroSchema.omit({ ruc: true, codigoCorto: true }).partial();
export type ClienteActualizacion = z.infer<typeof ClienteActualizacionSchema>;

/**
 * Cliente tal como lo devuelve el servidor. La base de datos admite códigos más
 * laxos que el alta (3 a 10 caracteres, con guion bajo), por eso se relaja aquí.
 */
export const ClienteDetalleSchema = ClienteRegistroSchema.extend({
  id: z.string().uuid(),
  codigoCorto: z.string().regex(/^[A-Z0-9_]{3,10}$/),
  estado: EstadoActivoInactivoSchema,
});
export type ClienteDetalle = z.infer<typeof ClienteDetalleSchema>;
