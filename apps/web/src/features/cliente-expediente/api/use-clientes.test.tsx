import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useActivarCliente,
  useActualizarCliente,
  useCliente,
  useClientes,
  useCrearCliente,
  useDesactivarCliente,
} from './use-clientes';
import { useSesion } from '../../../shared/api/sesion';
import type { DatosCliente } from '../model/validaciones';

const fetchMock = vi.fn();

const ID = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';

const resumen = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  razonSocial: `Cliente ${n}`,
  ruc: String(20000000000 + n),
  codigoCorto: `COD${n}`.padEnd(4, 'X'),
  estado: 'ACTIVO',
  giroNegocio: 'Energía',
  contactoNombre: 'Rosa',
  contactoTelefono: '959 214 380',
  contactoCorreo: 'r@x.pe',
});

const detalle = {
  id: ID,
  razonSocial: 'Kallpa Energía S.A.',
  ruc: '20512345678',
  codigoCorto: 'KALLPA',
  direccionFiscal: 'Av. Víctor Andrés Belaúnde 147',
  giroNegocio: 'Energía',
  contactoNombre: 'Rosa Contreras',
  contactoCargo: 'Jefa de Planta',
  contactoTelefono: '959 214 380',
  contactoCorreo: 'rcontreras@kallpa.pe',
  estado: 'ACTIVO',
  camposExtra: { anticipacionAlertaDias: 45 },
};

const datos: DatosCliente = {
  razonSocial: 'Kallpa Energía S.A.C.',
  ruc: '20512345678',
  codigoCorto: 'KALLPA',
  direccionFiscal: 'Av. Víctor Andrés Belaúnde 147',
  giro: 'Energía',
  contactoNombre: 'Rosa Contreras',
  contactoCargo: 'Jefa de Planta',
  contactoTelefono: '959 214 380',
  contactoCorreo: 'rcontreras@kallpa.pe',
  estado: 'ACTIVO',
};

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function llamadas(metodo: string, sufijo?: string) {
  return fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === metodo && (!sufijo || String(url).includes(sufijo)));
}

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de clientes', () => {
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

  describe('useClientes', () => {
    it('trae todas las páginas del listado y las mapea al modelo de vista', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        const offset = Number(new URL(url).searchParams.get('offset'));
        const todos = Array.from({ length: 130 }, (_, i) => resumen(i + 1));
        return json(200, { total: 130, limit: 100, offset, items: todos.slice(offset, offset + 100) });
      });

      const { result } = renderHook(() => useClientes(), { wrapper: envoltorio });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(130);
      expect(result.current.data?.[0]).toMatchObject({ razonSocial: 'Cliente 1', giro: 'Energía', proximoVencimiento: null });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0][0])).toContain('/mantenimiento/clientes?limit=100&offset=0');
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
    });

    it('expone el error cuando el API falla', async () => {
      fetchMock.mockResolvedValue(json(500, { statusCode: 500, message: 'Ocurrió un error interno en el servidor' }));

      const { result } = renderHook(() => useClientes(), { wrapper: envoltorio });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ tipo: 'servidor' });
    });
  });

  describe('useCliente', () => {
    it('trae la ficha y la mapea (contacto agrupado, anticipación en días)', async () => {
      fetchMock.mockResolvedValue(json(200, detalle));

      const { result } = renderHook(() => useCliente(ID), { wrapper: envoltorio });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(String(fetchMock.mock.calls[0][0])).toMatch(new RegExp(`/mantenimiento/clientes/${ID}$`));
      expect(result.current.data).toMatchObject({ giro: 'Energía', anticipacionAlertaDias: 45, contacto: { cargo: 'Jefa de Planta' } });
    });

    it('no consulta nada sin identificador', () => {
      renderHook(() => useCliente(null), { wrapper: envoltorio });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('useCrearCliente', () => {
    it('envía el alta con la anticipación y refresca el listado', async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return json(201, resumen(1));
        return json(200, { total: 0, limit: 100, offset: 0, items: [] });
      });
      const lista = renderHook(() => useClientes(), { wrapper: envoltorio });
      await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));
      const { result } = renderHook(() => useCrearCliente(), { wrapper: envoltorio });

      let creado: unknown;
      await act(async () => {
        creado = await result.current.mutateAsync({ datos, anticipacionAlertaDias: 60 });
      });

      const [post] = llamadas('POST');
      expect(JSON.parse(post[1].body)).toMatchObject({ ruc: '20512345678', codigoCorto: 'KALLPA', giroNegocio: 'Energía', camposExtra: { anticipacionAlertaDias: 60 } });
      expect(creado).toMatchObject({ id: resumen(1).id });
      await waitFor(() => expect(llamadas('GET')).toHaveLength(2));
    });

    it('propaga los errores por campo del servidor', async () => {
      fetchMock.mockResolvedValue(json(400, { statusCode: 400, message: ['ruc: x'], errors: [{ path: 'ruc', message: 'x' }] }));
      const { result } = renderHook(() => useCrearCliente(), { wrapper: envoltorio });

      await act(async () => {
        await result.current.mutateAsync({ datos, anticipacionAlertaDias: 30 }).catch(() => undefined);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ tipo: 'validacion', campos: { ruc: 'x' } });
    });
  });

  describe('useActualizarCliente', () => {
    it('envía solo la ficha editable, deja la ficha en caché e invalida el listado', async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') return json(200, { ...detalle, razonSocial: datos.razonSocial });
        return json(200, { total: 0, limit: 100, offset: 0, items: [] });
      });
      const lista = renderHook(() => useClientes(), { wrapper: envoltorio });
      await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));
      const { result } = renderHook(() => useActualizarCliente(), { wrapper: envoltorio });

      await act(async () => {
        await result.current.mutateAsync({ id: ID, datos, anticipacionAlertaDias: 15 });
      });

      const [patch] = llamadas('PATCH');
      expect(String(patch[0])).toMatch(new RegExp(`/mantenimiento/clientes/${ID}$`));
      const cuerpo = JSON.parse(patch[1].body);
      expect(cuerpo).not.toHaveProperty('ruc');
      expect(cuerpo).not.toHaveProperty('codigoCorto');
      expect(cuerpo).toMatchObject({ razonSocial: 'Kallpa Energía S.A.C.', camposExtra: { anticipacionAlertaDias: 15 } });
      expect(cliente.getQueryData(['clientes', 'detalle', ID])).toMatchObject({ razonSocial: 'Kallpa Energía S.A.C.' });
      await waitFor(() => expect(llamadas('GET')).toHaveLength(2));
    });
  });

  describe.each([
    ['activar', useActivarCliente, 'INACTIVO', 'ACTIVO'],
    ['desactivar', useDesactivarCliente, 'ACTIVO', 'INACTIVO'],
  ] as const)('%s', (accion, usar, desde, hacia) => {
    it(`llama a PATCH …/${accion} e invalida listado y ficha`, async () => {
      let estadoServidor: string = desde;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          estadoServidor = hacia;
          return json(200, { id: ID, estado: hacia });
        }
        if (String(url).includes(ID)) return json(200, { ...detalle, estado: estadoServidor });
        return json(200, { total: 0, limit: 100, offset: 0, items: [] });
      });
      const ficha = renderHook(() => useCliente(ID), { wrapper: envoltorio });
      await waitFor(() => expect(ficha.result.current.data?.estado).toBe(desde));
      const { result } = renderHook(() => usar(), { wrapper: envoltorio });

      await act(async () => {
        await result.current.mutateAsync(ID);
      });

      expect(String(llamadas('PATCH')[0][0])).toMatch(new RegExp(`/mantenimiento/clientes/${ID}/${accion}$`));
      await waitFor(() => expect(ficha.result.current.data?.estado).toBe(hacia));
    });
  });
});
