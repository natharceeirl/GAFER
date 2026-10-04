import { beforeEach, describe, expect, it } from 'vitest';
import { CLAVE_SESION, cargarSesionGuardada, useSesion } from './sesion';

const usuario = {
  id: '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11',
  dni: '12345678',
  nombres: 'Rosa',
  apellidos: 'Agárate',
  cargo: 'ADMINISTRADOR' as const,
  usuario: 'r.agarate',
};

describe('sesión del backoffice', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useSesion.setState({ token: null, usuario: null });
  });

  it('iniciar guarda el token y el usuario en memoria y en sessionStorage', () => {
    useSesion.getState().iniciar('token-1', usuario);

    expect(useSesion.getState().token).toBe('token-1');
    expect(useSesion.getState().usuario?.cargo).toBe('ADMINISTRADOR');
    expect(JSON.parse(sessionStorage.getItem(CLAVE_SESION) ?? '{}')).toEqual({ token: 'token-1', usuario });
  });

  it('cerrar limpia la memoria y el almacenamiento de la pestaña', () => {
    useSesion.getState().iniciar('token-1', usuario);
    useSesion.getState().cerrar();

    expect(useSesion.getState().token).toBeNull();
    expect(useSesion.getState().usuario).toBeNull();
    expect(sessionStorage.getItem(CLAVE_SESION)).toBeNull();
  });

  it('cargarSesionGuardada recupera una sesión válida', () => {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ token: 'token-2', usuario }));

    expect(cargarSesionGuardada()).toEqual({ token: 'token-2', usuario });
  });

  it.each([
    ['JSON dañado', '{no-es-json'],
    ['sin token', JSON.stringify({ usuario })],
    ['rol de técnico, que no usa la web', JSON.stringify({ token: 't', usuario: { ...usuario, cargo: 'TECNICO_OPERADOR' } })],
  ])('cargarSesionGuardada descarta %s', (_caso, crudo) => {
    sessionStorage.setItem(CLAVE_SESION, crudo);

    expect(cargarSesionGuardada()).toBeNull();
  });
});
