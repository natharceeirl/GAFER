import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActivarInsumo, useActualizarInsumo, useCrearInsumo, useDesactivarInsumo, useInsumos } from './use-insumos';
import { useSesion } from '../../../shared/api/sesion';
import type { DatosInsumo } from '../model/insumo-mapper';

const fetchMock = vi.fn();

const ID = '11111111-1111-4111-8111-111111111111';

const insumoApi = (n: number, estado = 'ACTIVO') => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  nombreComercial: `Insumo ${n}`,
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: `DIG-${n}`,
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  fichaTecnicaKey: 'f',
  hojaMsdsKey: 'h',
  resolucionKey: null,
  proveedor: null,
  estado,
});

const datos: DatosInsumo = {
  nombreComercial: 'Brodifacoum 0.005% bloque',
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: 'DIG-2451-SA',
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  proveedor: '',
  fichaTecnicaKey: 'insumos/ficha-tecnica/a.pdf',
  hojaMsdsKey: 'insumos/hoja-msds/b.pdf',
};

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function llamadas(metodo: string, sufijo?: string) {
  return fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === metodo && (!sufijo || String(url).includes(sufijo)));
}

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de insumos', () => {
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

  describe('useInsumos', () => {
    it('trae todas las páginas del catálogo con la forma del API', async () => {
      const todos = Array.from({ length: 101 }, (_, i) => insumoApi(i + 1));
      fetchMock.mockImplementation(async (url: string) => {
        const offset = Number(new URL(url).searchParams.get('offset'));
        return json(200, { total: 101, limit: 100, offset, items: todos.slice(offset, offset + 100) });
      });
      const { result } = renderHook(() => useInsumos(), { wrapper: envoltorio });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(101);
      expect(result.current.data?.[0]).toMatchObject({ nombreComercial: 'Insumo 1', presentacion: 'BLOQUE', dosisEstandar: '1 bloque por estación' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mantenimiento\/insumos\?/);
    });

    it('no consulta si el rol no puede leer el catálogo', () => {
      renderHook(() => useInsumos(false), { wrapper: envoltorio });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('un 403 queda como error de permiso, sin lanzar', async () => {
      fetchMock.mockResolvedValue(json(403, { statusCode: 403, message: 'Forbidden resource' }));
      const { result } = renderHook(() => useInsumos(), { wrapper: envoltorio });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ tipo: 'prohibido', status: 403 });
    });
  });

  describe('escritura', () => {
    it('crea un insumo con el cuerpo del alta y vuelve a leer el catálogo', async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'POST' ? json(201, insumoApi(1)) : json(200, { total: 0, limit: 100, offset: 0, items: [] }),
      );
      const lectura = renderHook(() => useInsumos(), { wrapper: envoltorio });
      await waitFor(() => expect(lectura.result.current.isSuccess).toBe(true));
      const { result } = renderHook(() => useCrearInsumo(), { wrapper: envoltorio });

      await act(() => result.current.mutateAsync(datos));

      const [[url, init]] = llamadas('POST');
      expect(String(url)).toMatch(/\/api\/mantenimiento\/insumos$/);
      expect(JSON.parse(init.body)).toMatchObject({ nombreComercial: 'Brodifacoum 0.005% bloque', proveedor: null, fichaTecnicaKey: 'insumos/ficha-tecnica/a.pdf' });
      await waitFor(() => expect(llamadas('GET', '/insumos')).toHaveLength(2));
    });

    it('edita un insumo con PATCH a su id', async () => {
      fetchMock.mockResolvedValue(json(200, insumoApi(1)));
      const { result } = renderHook(() => useActualizarInsumo(), { wrapper: envoltorio });

      await act(() => result.current.mutateAsync({ id: ID, datos }));

      const [[url, init]] = llamadas('PATCH');
      expect(String(url)).toMatch(new RegExp(`/api/mantenimiento/insumos/${ID}$`));
      expect(JSON.parse(init.body)).not.toHaveProperty('estado');
    });

    it('activa y desactiva por sus rutas propias', async () => {
      fetchMock.mockImplementation(async () => json(200, { id: ID, estado: 'INACTIVO' }));
      const desactivar = renderHook(() => useDesactivarInsumo(), { wrapper: envoltorio });
      const activar = renderHook(() => useActivarInsumo(), { wrapper: envoltorio });

      await act(() => desactivar.result.current.mutateAsync(ID));
      await act(() => activar.result.current.mutateAsync(ID));

      expect(llamadas('PATCH').map(([url]) => String(url).split('/api/mantenimiento')[1])).toEqual([`/insumos/${ID}/desactivar`, `/insumos/${ID}/activar`]);
    });

    it('un 400 llega con los mensajes por campo para mostrarlos en el formulario', async () => {
      fetchMock.mockResolvedValue(
        json(400, { statusCode: 400, message: 'Validation failed', errors: [{ path: 'concentracion', message: 'Requerido' }] }),
      );
      const { result } = renderHook(() => useCrearInsumo(), { wrapper: envoltorio });

      await act(async () => {
        await expect(result.current.mutateAsync(datos)).rejects.toMatchObject({ tipo: 'validacion', campos: { concentracion: 'Requerido' } });
      });
    });
  });
});
