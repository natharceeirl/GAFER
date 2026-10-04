import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './http-client';
import { ErrorApi } from './errores';
import { useSesion } from './sesion';

const fetchMock = vi.fn();

function respuesta(status: number, cuerpo?: unknown) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status,
    headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
  });
}

async function capturar(promesa: Promise<unknown>): Promise<ErrorApi> {
  try {
    await promesa;
  } catch (e) {
    return e as ErrorApi;
  }
  throw new Error('Se esperaba un error');
}

const usuario = {
  id: '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11',
  dni: '12345678',
  nombres: 'Rosa',
  apellidos: 'Agárate',
  cargo: 'ADMINISTRADOR' as const,
  usuario: 'r.agarate',
};

describe('cliente HTTP', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: null, usuario: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('antepone la URL base con /api y envía JSON', async () => {
    fetchMock.mockResolvedValue(respuesta(201, { id: 'x' }));

    const resultado = await apiFetch('/mantenimiento/clientes', { metodo: 'POST', cuerpo: { razonSocial: 'A' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/mantenimiento/clientes');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ razonSocial: 'A' }));
    expect(resultado).toEqual({ id: 'x' });
  });

  it('agrega los parámetros de consulta definidos y omite los vacíos', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

    await apiFetch('/mantenimiento/clientes', { consulta: { limit: 100, offset: 0, busqueda: undefined } });

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/mantenimiento/clientes?limit=100&offset=0');
  });

  it('adjunta Authorization: Bearer cuando hay sesión', async () => {
    useSesion.getState().iniciar('token-abc', usuario);
    fetchMock.mockResolvedValue(respuesta(200, {}));

    await apiFetch('/auth/perfil');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-abc');
  });

  it('no envía Authorization sin sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(200, {}));

    await apiFetch('/auth/login', { metodo: 'POST', cuerpo: {} });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('acepta respuestas sin cuerpo (204)', async () => {
    fetchMock.mockResolvedValue(respuesta(204));

    await expect(apiFetch('/algo', { metodo: 'PATCH' })).resolves.toBeUndefined();
  });

  it('400 con errors[] se traduce a errores por campo', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, {
        statusCode: 400,
        message: ['ruc: El RUC tiene 11 dígitos', 'contactoCorreo: Invalid email'],
        errors: [
          { path: 'ruc', message: 'El RUC tiene 11 dígitos' },
          { path: 'contactoCorreo', message: 'Invalid email' },
        ],
      }),
    );

    const error = await capturar(apiFetch('/mantenimiento/clientes', { metodo: 'POST', cuerpo: {} }));

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.tipo).toBe('validacion');
    expect(error.status).toBe(400);
    expect(error.campos).toEqual({ ruc: 'El RUC tiene 11 dígitos', contactoCorreo: 'Invalid email' });
    expect(error.mensajes).toEqual(['El RUC tiene 11 dígitos', 'Invalid email']);
  });

  it('400 de dominio con un solo mensaje queda sin campos', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { statusCode: 400, message: 'El cliente no puede quedar sin razón social' }));

    const error = await capturar(apiFetch('/x', { metodo: 'PATCH', cuerpo: {} }));

    expect(error.tipo).toBe('validacion');
    expect(error.campos).toEqual({});
    expect(error.message).toBe('El cliente no puede quedar sin razón social');
  });

  it('401 con sesión activa la cierra y lanza un error no autenticado', async () => {
    useSesion.getState().iniciar('token-vencido', usuario);
    fetchMock.mockResolvedValue(respuesta(401, { statusCode: 401, message: 'Token inválido o expirado' }));

    const error = await capturar(apiFetch('/mantenimiento/clientes'));

    expect(error.tipo).toBe('no-autenticado');
    expect(useSesion.getState().token).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('401 sin sesión (credenciales inválidas) conserva el mensaje del servidor', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { statusCode: 401, message: 'Credenciales inválidas' }));

    const error = await capturar(apiFetch('/auth/login', { metodo: 'POST', cuerpo: {} }));

    expect(error.tipo).toBe('no-autenticado');
    expect(error.message).toBe('Credenciales inválidas');
  });

  it('403 y 409 y 404 se tipan con el mensaje del servidor', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(403, { statusCode: 403, message: 'Acceso denegado' }));
    fetchMock.mockResolvedValueOnce(respuesta(409, { statusCode: 409, message: 'Ya existe un cliente registrado con el RUC: 20111111111' }));
    fetchMock.mockResolvedValueOnce(respuesta(404, { statusCode: 404, message: 'Cliente x no encontrado' }));

    const prohibido = await capturar(apiFetch('/a'));
    const conflicto = await capturar(apiFetch('/b'));
    const noEncontrado = await capturar(apiFetch('/c'));

    expect([prohibido.tipo, prohibido.message]).toEqual(['prohibido', 'Acceso denegado']);
    expect([conflicto.tipo, conflicto.message]).toEqual(['conflicto', 'Ya existe un cliente registrado con el RUC: 20111111111']);
    expect(noEncontrado.tipo).toBe('no-encontrado');
  });

  it('500 se muestra con un mensaje genérico', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { statusCode: 500, message: 'Ocurrió un error interno en el servidor' }));

    const error = await capturar(apiFetch('/x'));

    expect(error.tipo).toBe('servidor');
    expect(error.status).toBe(500);
  });

  it('red caída lanza un error de red sin estado HTTP', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await capturar(apiFetch('/x'));

    expect(error.tipo).toBe('red');
    expect(error.status).toBeNull();
    expect(error.message).toMatch(/conectar con el servidor/);
  });
});
