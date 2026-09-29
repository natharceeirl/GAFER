import { z } from 'zod';
import { CargoPersonalSchema } from './catalogos';

export const RolUsuarioSchema = CargoPersonalSchema;
export type RolUsuario = z.infer<typeof RolUsuarioSchema>;

export const OrigenClienteSchema = z.enum(['web', 'mobile']);
export type OrigenCliente = z.infer<typeof OrigenClienteSchema>;

export const LoginRequestSchema = z.object({
  usuario: z.string().min(1, 'El usuario es obligatorio'),
  clave: z.string().min(1, 'La clave es obligatoria'),
  cliente: OrigenClienteSchema.optional().default('web'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UsuarioSesionSchema = z.object({
  id: z.string().uuid(),
  dni: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  cargo: RolUsuarioSchema,
  usuario: z.string(),
});
export type UsuarioSesion = z.infer<typeof UsuarioSesionSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  usuario: UsuarioSesionSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
