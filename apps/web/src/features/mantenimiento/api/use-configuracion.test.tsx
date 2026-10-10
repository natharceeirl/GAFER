import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActualizarConfiguracion, useConfiguracionSistema } from './use-configuracion';
import { useSesion } from '../../../shared/api/sesion';

const fetchMock = vi.fn();

const configuracion = {
  id: 'global',
  director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: null },
  resolucionSanitaria: '0023-2024-DESA/MINSA',
  parametros: {},
  actualizadoPor: null,
  updatedAt: '2026-10-04T00:00:00.000Z',
};

const json = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de configuración', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
    cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lee la configuración del sistema', async () => {
    fetchMock.mockImplementation(async () => json(200, configuracion));
    const { result } = renderHook(() => useConfiguracionSistema(), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.director?.cip).toBe('84512');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mantenimiento\/configuracion$/);
  });

  it('no consulta si se deshabilita', () => {
    renderHook(() => useConfiguracionSistema(false), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('guarda con PATCH y deja la configuración nueva en la caché', async () => {
    const nueva = { ...configuracion, director: { nombre: 'Ing. Ana Paz', cip: '12345', firma: null } };
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => ((init?.method ?? 'GET') === 'PATCH' ? json(200, nueva) : json(200, configuracion)));
    const lectura = renderHook(() => useConfiguracionSistema(), { wrapper: envoltorio });
    await waitFor(() => expect(lectura.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useActualizarConfiguracion(), { wrapper: envoltorio });

    await act(() => result.current.mutateAsync({ directorNombre: 'Ing. Ana Paz', directorCip: '12345', directorFirma: null, resolucionSanitaria: '0023-2024-DESA/MINSA' }));

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch?.[1].body)).toEqual({ director: { nombre: 'Ing. Ana Paz', cip: '12345', firma: null }, resolucionSanitaria: '0023-2024-DESA/MINSA' });
    expect(cliente.getQueryData<typeof configuracion>(['mantenimiento', 'configuracion'])?.director?.nombre).toBe('Ing. Ana Paz');
  });
});
