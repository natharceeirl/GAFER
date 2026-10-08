import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActivarPersonal, useActualizarPersonal, useCrearPersonal, useDesactivarPersonal, usePersonal } from './use-personal';
import { useSesion } from '../../../shared/api/sesion';
import type { DatosPersonal } from '../model/personal-mapper';

const fetchMock = vi.fn();
const ID = '33333333-3333-4333-8333-333333333333';

const personalApi = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  dni: String(40000000 + n),
  nombres: `Nombre ${n}`,
  apellidos: `Apellido ${n}`,
  cargo: 'TECNICO_OPERADOR',
  telefono: '958123456',
  usuario: null,
  estado: 'ACTIVO',
});

const datos: DatosPersonal = { dni: '45892312', nombres: 'Marco', apellidos: 'Ipusari', cargo: 'TECNICO_OPERADOR', telefono: '958123456', usuario: '' };

const json = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const llamadas = (metodo: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === metodo);

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de personal', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
    cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('trae todas las páginas del personal', async () => {
    const todos = Array.from({ length: 101 }, (_, i) => personalApi(i + 1));
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get('offset'));
      return json(200, { total: 101, limit: 100, offset, items: todos.slice(offset, offset + 100) });
    });
    const { result } = renderHook(() => usePersonal(), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(101);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mantenimiento\/personal\?/);
  });

  it('no consulta si el rol no puede leerlo', () => {
    renderHook(() => usePersonal(false), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un 403 queda como error de permiso', async () => {
    fetchMock.mockImplementation(async () => json(403, { statusCode: 403, message: 'Forbidden resource' }));
    const { result } = renderHook(() => usePersonal(), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ tipo: 'prohibido' });
  });

  it('crea con el cuerpo del alta (sin clave) y refresca la lista', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'POST' ? json(201, personalApi(1)) : json(200, { total: 0, limit: 100, offset: 0, items: [] }),
    );
    const lectura = renderHook(() => usePersonal(), { wrapper: envoltorio });
    await waitFor(() => expect(lectura.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useCrearPersonal(), { wrapper: envoltorio });

    await act(() => result.current.mutateAsync(datos));

    const [[url, init]] = llamadas('POST');
    expect(String(url)).toMatch(/\/api\/mantenimiento\/personal$/);
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo).toMatchObject({ nombres: 'Marco', cargo: 'TECNICO_OPERADOR', usuario: null });
    expect(cuerpo).not.toHaveProperty('clave');
    await waitFor(() => expect(llamadas('GET')).toHaveLength(2));
  });

  it('edita con PATCH, activa y desactiva por sus rutas', async () => {
    fetchMock.mockImplementation(async () => json(200, personalApi(1)));
    const editar = renderHook(() => useActualizarPersonal(), { wrapper: envoltorio });
    const activar = renderHook(() => useActivarPersonal(), { wrapper: envoltorio });
    const desactivar = renderHook(() => useDesactivarPersonal(), { wrapper: envoltorio });

    await act(() => editar.result.current.mutateAsync({ id: ID, datos }));
    await act(() => activar.result.current.mutateAsync(ID));
    await act(() => desactivar.result.current.mutateAsync(ID));

    expect(llamadas('PATCH').map(([url]) => String(url).split('/api/mantenimiento')[1])).toEqual([`/personal/${ID}`, `/personal/${ID}/activar`, `/personal/${ID}/desactivar`]);
  });
});
