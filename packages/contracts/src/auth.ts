import { z } from 'zod';
import { DniSchema, TelefonoSchema } from './comun';
import { CargoPersonalSchema } from './catalogos';

export const RolUsuarioSchema = CargoPersonalSchema;
export type RolUsuario = z.infer<typeof RolUsuarioSchema>;

export const OrigenClienteSchema = z.enum(['web', 'mobile']);
export type OrigenCliente = z.infer<typeof OrigenClienteSchema>;

export const LoginRequestSchema = z.object({
  usuario: z.string().min(1, 'El usuario es obligatorio').describe('Nombre de usuario en el sistema'),
  clave: z.string().min(1, 'La clave es obligatoria').describe('Contraseña o clave de acceso'),
  cliente: OrigenClienteSchema.optional().default('web').describe('Cliente origen de la solicitud (web o mobile)'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UsuarioSesionSchema = z.object({
  id: z.string().uuid().describe('ID único del personal/usuario'),
  dni: z.string().describe('Número de DNI'),
  nombres: z.string().describe('Nombres'),
  apellidos: z.string().describe('Apellidos'),
  cargo: RolUsuarioSchema.describe('Rol del usuario en el sistema'),
  usuario: z.string().describe('Nombre de usuario'),
});
export type UsuarioSesion = z.infer<typeof UsuarioSesionSchema>;

export const LoginResponseSchema = z.object({
  token: z.string().describe('Token de autenticación JWT Bearer'),
  usuario: UsuarioSesionSchema.describe('Datos de la sesión activa'),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** Política mínima de clave al crearla o cambiarla; el login no la exige para no revelar la política. */
export const ClaveNuevaSchema = z
  .string()
  .min(12, 'La clave debe tener al menos 12 caracteres')
  .max(128, 'La clave admite hasta 128 caracteres');

/** Alta o actualización de un usuario con clave desde la línea de comandos (`db:crear-usuario`). */
export const CrearUsuarioSchema = z.object({
  usuario: z
    .string()
    .trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario admite hasta 50 caracteres')
    .regex(/^[A-Za-z0-9._-]+$/, 'El usuario solo admite letras, dígitos y . _ -')
    .transform((valor) => valor.toUpperCase()),
  cargo: CargoPersonalSchema,
  dni: DniSchema,
  nombres: z.string().trim().min(1, 'Los nombres son obligatorios').max(100),
  apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios').max(100),
  telefono: TelefonoSchema.optional(),
  clave: ClaveNuevaSchema,
});
export type CrearUsuario = z.infer<typeof CrearUsuarioSchema>;
