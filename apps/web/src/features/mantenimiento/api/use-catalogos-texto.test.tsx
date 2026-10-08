import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActualizarCatalogoTexto, useAgregarItemCatalogo, useCatalogosTexto } from './use-catalogos-texto';
import { useSesion } from '../../../shared/api/sesion';

const fetchMock = vi.fn();

const catalogos = [
  { id: 'giros', titulo: 'Giros de negocio', items: ['Energía', 'Alimentos'], soloAdministrador: false },
  { id: 'motivos-modificacion', titulo: 'Motivos de modificación', items: ['Error'], soloAdministrador: true },
];

const json = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const llamadas = (metodo: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === metodo);

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de catálogos de texto', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
    cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lista los catálogos que entrega el API (ya filtrados por rol)', async () => {
    fetchMock.mockImplementation(async () => json(200, catalogos));
    const { result } = renderHook(() => useCatalogosTexto(), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(catalogos);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mantenimiento\/catalogos-texto$/);
  });

  it('agrega un texto con POST y deja el catálogo actualizado en la caché', async () => {
    const conMineria = { ...catalogos[0], items: ['Energía', 'Alimentos', 'Minería'] };
    let agregado = false;
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') {
        agregado = true;
        return json(201, conMineria);
      }
      return json(200, agregado ? [conMineria, catalogos[1]] : catalogos);
    });
    const lectura = renderHook(() => useCatalogosTexto(), { wrapper: envoltorio });
    await waitFor(() => expect(lectura.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useAgregarItemCatalogo(), { wrapper: envoltorio });

    await act(() => result.current.mutateAsync({ id: 'giros', item: ' Minería ' }));

    const [[url, init]] = llamadas('POST');
    expect(String(url)).toMatch(/\/catalogos-texto\/giros\/items$/);
    expect(JSON.parse(init.body)).toEqual({ item: 'Minería' });
    expect(cliente.getQueryData<typeof catalogos>(['mantenimiento', 'catalogos-texto'])?.[0].items).toContain('Minería');
  });

  it('reemplaza la lista completa con PUT', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'PUT' ? json(200, { ...catalogos[0], items: ['Energía'] }) : json(200, catalogos),
    );
    const { result } = renderHook(() => useActualizarCatalogoTexto(), { wrapper: envoltorio });

    await act(() => result.current.mutateAsync({ id: 'giros', items: ['Energía'] }));

    const [[url, init]] = llamadas('PUT');
    expect(String(url)).toMatch(/\/catalogos-texto\/giros$/);
    expect(JSON.parse(init.body)).toEqual({ items: ['Energía'] });
  });

  it('un 403 al editar el catálogo solo de Administrador llega como error de permiso', async () => {
    fetchMock.mockImplementation(async () => json(403, { statusCode: 403, message: "El catálogo 'motivos-modificacion' solo puede ser modificado por ADMINISTRADOR" }));
    const { result } = renderHook(() => useAgregarItemCatalogo(), { wrapper: envoltorio });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'motivos-modificacion', item: 'x' })).rejects.toMatchObject({ tipo: 'prohibido' });
    });
  });
});
