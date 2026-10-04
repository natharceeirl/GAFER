import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './LoginPage';
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

function montar() {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <LoginPage />
    </QueryClientProvider>,
  );
}

function completar(usuario: string, clave: string) {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: usuario } });
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: clave } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: null, usuario: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no permite ingresar con campos vacíos', () => {
    montar();

    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled();
  });

  it('ingreso correcto: guarda la sesión con el rol de la respuesta', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 'jwt-1', usuario: usuarioApi }));
    montar();

    completar('r.agarate', 'clave-secreta');

    await waitFor(() => expect(useSesion.getState().usuario?.cargo).toBe('ADMINISTRADOR'));
    expect(useSesion.getState().token).toBe('jwt-1');
  });

  it('credenciales inválidas: muestra el error y mantiene el formulario', async () => {
    fetchMock.mockResolvedValue(json(401, { statusCode: 401, message: 'Credenciales inválidas' }));
    montar();

    completar('r.agarate', 'mala');

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
    expect(useSesion.getState().token).toBeNull();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('Técnico Operador: muestra que no tiene acceso a la web y no inicia sesión', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 'jwt-2', usuario: { ...usuarioApi, cargo: 'TECNICO_OPERADOR' } }));
    montar();

    completar('t.quispe', 'clave');

    expect(await screen.findByRole('alert')).toHaveTextContent(/aplicación Android/);
    expect(useSesion.getState().token).toBeNull();
  });

  it('deshabilita el botón mientras valida las credenciales', async () => {
    let resolver: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((res) => (resolver = res)));
    montar();

    completar('r.agarate', 'clave');

    expect(await screen.findByRole('button', { name: 'Ingresando…' })).toBeDisabled();
    resolver(json(401, { statusCode: 401, message: 'Credenciales inválidas' }));
    await screen.findByRole('alert');
  });
});
