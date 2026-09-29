import { describe, expect, it } from 'vitest';
import {
  LoginRequestSchema,
  LoginResponseSchema,
  RolUsuarioSchema,
  UsuarioSesionSchema,
} from './auth';

describe('Contratos de Autenticación y Roles (GAF-8 / Spec §12)', () => {
  it('valida los tres roles oficiales del sistema', () => {
    expect(RolUsuarioSchema.parse('ADMINISTRADOR')).toBe('ADMINISTRADOR');
    expect(RolUsuarioSchema.parse('SUPERVISOR')).toBe('SUPERVISOR');
    expect(RolUsuarioSchema.parse('TECNICO_OPERADOR')).toBe('TECNICO_OPERADOR');
    expect(() => RolUsuarioSchema.parse('OTRO_ROL')).toThrow();
  });

  it('valida una solicitud de login válida', () => {
    const data = LoginRequestSchema.parse({
      usuario: 'r.agarate',
      clave: 'Admin123!',
      cliente: 'web',
    });
    expect(data.usuario).toBe('r.agarate');
    expect(data.cliente).toBe('web');
  });

  it('asigna cliente web por defecto si se omite', () => {
    const data = LoginRequestSchema.parse({
      usuario: 'd.amamani',
      clave: 'Sup123!',
    });
    expect(data.cliente).toBe('web');
  });

  it('rechaza login con campos vacíos', () => {
    expect(() => LoginRequestSchema.parse({ usuario: '', clave: '' })).toThrow();
  });

  it('valida la respuesta de login y datos de sesión', () => {
    const sesion = UsuarioSesionSchema.parse({
      id: 'e21290b5-cf39-4840-a1bf-ce9d16c5daeb',
      dni: '12345678',
      nombres: 'Roberto',
      apellidos: 'Agarate',
      cargo: 'ADMINISTRADOR',
      usuario: 'r.agarate',
    });

    const resp = LoginResponseSchema.parse({
      token: 'jwt-token-valido',
      usuario: sesion,
    });
    expect(resp.token).toBe('jwt-token-valido');
    expect(resp.usuario.cargo).toBe('ADMINISTRADOR');
  });
});
