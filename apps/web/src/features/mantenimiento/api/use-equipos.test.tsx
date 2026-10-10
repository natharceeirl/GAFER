import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActualizarEquipo, useCambiarEstadoEquipo, useCrearEquipo, useEquipos } from './use-equipos';
import { useSesion } from '../../../shared/api/sesion';
import type { DatosEquipo } from '../model/equipo-mapper';

const fetchMock = vi.fn();

const ID = '22222222-2222-4222-8222-222222222222';

const equipoApi = (n: number, estadoOperativo = 'OPERATIVO') => ({
  id: `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`,
  codigoInterno: `EQ-${n}`,
  nombre: `Equipo ${n}`,
  tipo: 'ASPERSION',
  marcaModelo: null,
  estadoOperativo,
  fechaAdquisicion: null,
  ultimoMantenimiento: null,
  proximoMantenimiento: null,
});

const datos: DatosEquipo = {
  codigoInterno: 'eq-022',
  nombre: 'Aspersora de mochila 20L',
  tipo: 'ASPERSION',
  marcaModelo: '',
  fechaAdquisicion: '',
  ultimoMantenimiento: '',
  proximoMantenimiento: '',
};

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function llamadas(metodo: string) {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === metodo);
}

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de equipos', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
    cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trae los equipos con los códigos de la base (FUERA_SERVICIO), sin traducirlos', async () => {
    fetchMock.mockResolvedValue(json(200, { total: 2, limit: 100, offset: 0, items: [equipoApi(1), equipoApi(2, 'FUERA_SERVICIO')] }));
    const { result } = renderHook(() => useEquipos(), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[1]).toMatchObject({ nombre: 'Equipo 2', estadoOperativo: 'FUERA_SERVICIO' });
  });

  it('no consulta si el rol no puede leer el catálogo', () => {
    renderHook(() => useEquipos(false), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un 403 queda como error de permiso, sin lanzar', async () => {
    fetchMock.mockResolvedValue(json(403, { statusCode: 403, message: 'Forbidden resource' }));
    const { result } = renderHook(() => useEquipos(), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ tipo: 'prohibido', status: 403 });
  });

  it('crea un equipo con el código en mayúsculas y sin estado', async () => {
    fetchMock.mockResolvedValue(json(201, equipoApi(1)));
    const { result } = renderHook(() => useCrearEquipo(), { wrapper: envoltorio });

    await act(() => result.current.mutateAsync(datos));

    const [[url, init]] = llamadas('POST');
    expect(String(url)).toMatch(/\/api\/mantenimiento\/equipos$/);
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo).toMatchObject({ codigoInterno: 'EQ-022', marcaModelo: null, fechaAdquisicion: null });
    expect(cuerpo).not.toHaveProperty('estadoOperativo');
  });

  it('edita un equipo con PATCH a su id', async () => {
    fetchMock.mockResolvedValue(json(200, equipoApi(1)));
    const { result } = renderHook(() => useActualizarEquipo(), { wrapper: envoltorio });

    await act(() => result.current.mutateAsync({ id: ID, datos }));

    expect(String(llamadas('PATCH')[0][0])).toMatch(new RegExp(`/api/mantenimiento/equipos/${ID}$`));
  });

  it('cambia el estado operativo por su ruta propia y vuelve a leer el catálogo', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'PATCH' ? json(200, equipoApi(1, 'MANTENIMIENTO')) : json(200, { total: 0, limit: 100, offset: 0, items: [] }),
    );
    const lectura = renderHook(() => useEquipos(), { wrapper: envoltorio });
    await waitFor(() => expect(lectura.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useCambiarEstadoEquipo(), { wrapper: envoltorio });

    await act(() => result.current.mutateAsync({ id: ID, estadoOperativo: 'MANTENIMIENTO' }));

    const [[url, init]] = llamadas('PATCH');
    expect(String(url)).toMatch(new RegExp(`/api/mantenimiento/equipos/${ID}/estado$`));
    expect(JSON.parse(init.body)).toEqual({ estadoOperativo: 'MANTENIMIENTO' });
    await waitFor(() => expect(llamadas('GET')).toHaveLength(2));
  });
});
