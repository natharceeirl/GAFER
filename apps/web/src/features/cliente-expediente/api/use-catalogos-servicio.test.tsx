import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEquiposCatalogo, useInsumosCatalogo } from './use-catalogos-servicio';
import { useSesion } from '../../../shared/api/sesion';

const fetchMock = vi.fn();

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

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de catálogos para el formulario de servicio', () => {
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

  it('trae todas las páginas de insumos y las muestra con la forma que usa el formulario', async () => {
    const todos = Array.from({ length: 101 }, (_, i) => insumoApi(i + 1));
    fetchMock.mockImplementation(async (url: string) => {
      const consulta = new URL(url).searchParams;
      const offset = Number(consulta.get('offset'));
      return json(200, { total: 101, limit: 100, offset, items: todos.slice(offset, offset + 100) });
    });
    const { result } = renderHook(() => useInsumosCatalogo(true), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(101);
    expect(result.current.data?.[0]).toMatchObject({
      id: todos[0].id,
      nombre: 'Insumo 1',
      principioActivo: 'Brodifacoum',
      concentracion: '0.005%',
      registroDigesa: 'DIG-1',
      dosisReferencial: '1 bloque por estación',
      estado: 'ACTIVO',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('traduce los equipos: estado operativo y tipo con su etiqueta', async () => {
    fetchMock.mockResolvedValue(
      json(200, { total: 2, limit: 100, offset: 0, items: [equipoApi(1), equipoApi(2, 'FUERA_SERVICIO')] }),
    );
    const { result } = renderHook(() => useEquiposCatalogo(true), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ nombre: 'Equipo 1', codigoInterno: 'EQ-1', tipo: 'Aspersión', estadoOperativo: 'OPERATIVO' });
    expect(result.current.data?.[1].estadoOperativo).toBe('FUERA_DE_SERVICIO');
  });

  it('no consulta si el rol no puede leer el catálogo', () => {
    renderHook(() => useInsumosCatalogo(false), { wrapper: envoltorio });
    renderHook(() => useEquiposCatalogo(false), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un 403 queda como error de permiso, sin lanzar', async () => {
    fetchMock.mockResolvedValue(json(403, { statusCode: 403, message: 'Forbidden resource' }));
    const { result } = renderHook(() => useInsumosCatalogo(true), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ tipo: 'prohibido', status: 403 });
  });
});
