import { z } from 'zod';
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
