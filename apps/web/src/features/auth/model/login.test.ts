import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ingresar, MENSAJE_SIN_ACCESO_WEB } from './login';
import { ErrorApi } from '../../../shared/api/errores';
import { useSesion } from '../../../shared/api/sesion';

const fetchMock = vi.fn();

const usuarioApi = {
  id: '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11',
  dni: '12345678',
  nombres: 'Rosa',
  apellidos: 'Agárate',
  cargo: 'ADMINISTRADOR',
  usuario: 'r.agarate',
};

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ingreso con usuario y clave', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: null, usuario: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía las credenciales como cliente web y guarda la sesión', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 'jwt-1', usuario: usuarioApi }));

    const usuario = await ingresar('r.agarate', 'clave-secreta');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({ usuario: 'r.agarate', clave: 'clave-secreta', cliente: 'web' });
    expect(usuario.cargo).toBe('ADMINISTRADOR');
    expect(useSesion.getState().token).toBe('jwt-1');
    expect(useSesion.getState().usuario?.usuario).toBe('r.agarate');
  });

  it('credenciales inválidas: lanza el error del servidor y no deja sesión', async () => {
    fetchMock.mockResolvedValue(json(401, { statusCode: 401, message: 'Credenciales inválidas' }));

    await expect(ingresar('r.agarate', 'mala')).rejects.toMatchObject({ tipo: 'no-autenticado', message: 'Credenciales inválidas' });
    expect(useSesion.getState().token).toBeNull();
  });

  it('un Técnico Operador es rechazado con un mensaje claro y no inicia sesión', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 'jwt-2', usuario: { ...usuarioApi, cargo: 'TECNICO_OPERADOR' } }));

    const error = await ingresar('t.quispe', 'clave').catch((e: ErrorApi) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).tipo).toBe('prohibido');
    expect((error as ErrorApi).message).toBe(MENSAJE_SIN_ACCESO_WEB);
    expect(useSesion.getState().token).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('403 del servidor para un técnico conserva el mensaje claro', async () => {
    fetchMock.mockResolvedValue(json(403, { statusCode: 403, message: 'El rol TECNICO_OPERADOR solo tiene acceso a la aplicación móvil (decisión C10, §16)' }));

    await expect(ingresar('t.quispe', 'clave')).rejects.toMatchObject({ tipo: 'prohibido' });
    expect(useSesion.getState().token).toBeNull();
  });

  it('una respuesta con forma inesperada se trata como error del servidor', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 'x' }));

    await expect(ingresar('a', 'b')).rejects.toMatchObject({ tipo: 'servidor' });
    expect(useSesion.getState().token).toBeNull();
  });
});
