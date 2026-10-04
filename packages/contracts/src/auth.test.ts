import { describe, expect, it } from 'vitest';
import {
  ClaveNuevaSchema,
  CrearUsuarioSchema,
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
      clave: 'clave-de-ejemplo',
      cliente: 'web',
    });
    expect(data.usuario).toBe('r.agarate');
    expect(data.cliente).toBe('web');
  });

  it('asigna cliente web por defecto si se omite', () => {
    const data = LoginRequestSchema.parse({
      usuario: 'd.amamani',
      clave: 'clave-de-ejemplo',
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

  describe('Alta de usuarios con clave', () => {
    const datosValidos = {
      usuario: 'm.quispe',
      cargo: 'ADMINISTRADOR',
      dni: '45892312',
      nombres: 'Maria',
      apellidos: 'Quispe Rojas',
      telefono: '958123456',
    };

    it('exige una clave nueva de al menos 12 caracteres', () => {
      expect(() => ClaveNuevaSchema.parse('corta-11-ch')).toThrow();
      expect(ClaveNuevaSchema.parse('una-clave-de-12')).toBe('una-clave-de-12');
    });

    it('acepta el alta completa y normaliza el usuario a mayúsculas', () => {
      const data = CrearUsuarioSchema.parse({ ...datosValidos, clave: 'una-clave-de-12' });
      expect(data.usuario).toBe('M.QUISPE');
      expect(data.cargo).toBe('ADMINISTRADOR');
    });

    it('rechaza claves cortas, DNI inválido, cargo desconocido y usuario con caracteres raros', () => {
      const base = { ...datosValidos, clave: 'una-clave-de-12' };
      expect(() => CrearUsuarioSchema.parse({ ...base, clave: 'corta' })).toThrow();
      expect(() => CrearUsuarioSchema.parse({ ...base, dni: '123' })).toThrow();
      expect(() => CrearUsuarioSchema.parse({ ...base, cargo: 'OTRO' })).toThrow();
      expect(() => CrearUsuarioSchema.parse({ ...base, usuario: 'con espacio' })).toThrow();
    });
  });
});
