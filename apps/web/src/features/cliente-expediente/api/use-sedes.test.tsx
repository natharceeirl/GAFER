import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useActivarServicio,
  useActivarSede,
  useActualizarServicio,
  useActualizarSede,
  useCrearServicio,
  useCrearSede,
  useDesactivarServicio,
  useDesactivarSede,
  useSedes,
} from './use-sedes';
import { useSesion } from '../../../shared/api/sesion';
import type { DatosProyecto, DatosServicio } from '../model/validaciones';

const fetchMock = vi.fn();

const CLIENTE = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';
const SEDE = '7b1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a33';
const SERVICIO = '9d1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a44';
const INSUMO = '11111111-1111-4111-8111-111111111111';
const EQUIPO = '22222222-2222-4222-8222-222222222222';

const sedeApi = {
  id: SEDE,
  clienteId: CLIENTE,
  nombre: 'PLANTA_NORTE',
  direccionSede: 'Parque Industrial Mz. B',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  observaciones: null,
  estado: 'ACTIVO',
};

const servicioApi = {
  id: SERVICIO,
  proyectoId: SEDE,
  tipoServicio: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotalM2: 1200,
  areaTratarM2: 800,
  insumosAutorizados: [INSUMO],
  equiposAutorizados: [EQUIPO],
  dosisReferencial: { [INSUMO]: '1 bloque por estación' },
  requiereCertificado: true,
  vigenciaDias: 180,
  estado: 'ACTIVO',
};

const datosSede: DatosProyecto = {
  nombre: 'PLANTA_NORTE',
  direccion: 'Parque Industrial Mz. B',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  observaciones: '',
};

const datosServicio: DatosServicio = {
  tipo: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotal: '1200',
  areaTratar: '800',
  insumos: [INSUMO],
  dosis: { [INSUMO]: '1 bloque por estación' },
  equipos: [EQUIPO],
  requiereCertificado: true,
  vigenciaDias: '180',
};

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function llamadas(metodo: string, sufijo?: string) {
  return fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === metodo && (!sufijo || String(url).includes(sufijo)));
}

/** Responde las dos consultas de lectura de una sede con un servicio. */
function simularLectura() {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const { pathname } = new URL(url);
    if ((init?.method ?? 'GET') !== 'GET') return json(200, {});
    if (pathname === `/api/mantenimiento/proyectos/cliente/${CLIENTE}`) return json(200, [sedeApi]);
    if (pathname === `/api/mantenimiento/servicios-contratados/proyecto/${SEDE}`) return json(200, [servicioApi]);
    return json(404, { statusCode: 404, message: 'x' });
  });
}

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de sedes y servicios', () => {
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

  describe('useSedes', () => {
    it('trae las sedes del cliente con los servicios de cada una', async () => {
      simularLectura();
      const { result } = renderHook(() => useSedes(CLIENTE), { wrapper: envoltorio });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0]).toMatchObject({ id: SEDE, nombre: 'PLANTA_NORTE', direccion: 'Parque Industrial Mz. B', estado: 'ACTIVO' });
      expect(result.current.data?.[0].servicios).toEqual([
        expect.objectContaining({ id: SERVICIO, tipoServicio: 'DRT', frecuencia: 'QUINCENAL', vigenciaDias: 180 }),
      ]);
      expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mantenimiento\/proyectos\/cliente\//);
    });

    it('un cliente sin sedes devuelve una lista vacía y no pide servicios', async () => {
      fetchMock.mockResolvedValue(json(200, []));
      const { result } = renderHook(() => useSedes(CLIENTE), { wrapper: envoltorio });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sin cliente no consulta', () => {
      renderHook(() => useSedes(null), { wrapper: envoltorio });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('si falla la lectura de los servicios de una sede, falla toda la consulta y reintentar la repite', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        const { pathname } = new URL(url);
        if (pathname.includes('/proyectos/cliente/')) return json(200, [sedeApi]);
        return json(500, { statusCode: 500, message: 'x' });
      });
      const { result } = renderHook(() => useSedes(CLIENTE), { wrapper: envoltorio });
      await waitFor(() => expect(result.current.isError).toBe(true));

      simularLectura();
      await act(async () => {
        await result.current.refetch();
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('sedes', () => {
    it('crea una sede con el cuerpo del contrato y vuelve a leer las sedes del cliente', async () => {
      simularLectura();
      const lectura = renderHook(() => useSedes(CLIENTE), { wrapper: envoltorio });
      await waitFor(() => expect(lectura.result.current.isSuccess).toBe(true));
      const lecturas = llamadas('GET', '/proyectos/cliente/').length;

      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'POST' ? json(201, sedeApi) : json(200, [sedeApi]),
      );
      const { result } = renderHook(() => useCrearSede(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync({ clienteId: CLIENTE, datos: datosSede });
      });

      const [url, init] = llamadas('POST')[0];
      expect(String(url)).toMatch(/\/api\/mantenimiento\/proyectos$/);
      expect(JSON.parse(init.body)).toMatchObject({ clienteId: CLIENTE, nombre: 'PLANTA_NORTE', direccionSede: 'Parque Industrial Mz. B', observaciones: null });
      await waitFor(() => expect(llamadas('GET', '/proyectos/cliente/').length).toBeGreaterThan(lecturas));
    });

    it('edita una sede con PATCH sin enviar el cliente', async () => {
      fetchMock.mockResolvedValue(json(200, sedeApi));
      const { result } = renderHook(() => useActualizarSede(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync({ id: SEDE, datos: datosSede });
      });

      const [url, init] = llamadas('PATCH')[0];
      expect(String(url)).toMatch(new RegExp(`/api/mantenimiento/proyectos/${SEDE}$`));
      expect(JSON.parse(init.body)).not.toHaveProperty('clienteId');
    });

    it.each([
      ['desactiva', useDesactivarSede, 'desactivar'],
      ['activa', useActivarSede, 'activar'],
    ])('%s una sede por su ruta de estado', async (_nombre, usar, accion) => {
      fetchMock.mockResolvedValue(json(200, { id: SEDE, estado: 'INACTIVO' }));
      const { result } = renderHook(() => usar(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync(SEDE);
      });

      const [url] = llamadas('PATCH')[0];
      expect(String(url)).toMatch(new RegExp(`/api/mantenimiento/proyectos/${SEDE}/${accion}$`));
    });

    it('un error del servidor al crear llega como ErrorApi por campo', async () => {
      fetchMock.mockResolvedValue(
        json(400, { statusCode: 400, message: 'Validación', errors: [{ path: 'distrito', message: 'Obligatorio' }] }),
      );
      const { result } = renderHook(() => useCrearSede(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync({ clienteId: CLIENTE, datos: datosSede }).catch(() => undefined);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ tipo: 'validacion', campos: { distrito: 'Obligatorio' } });
    });
  });

  describe('servicios', () => {
    it('crea un servicio con el cuerpo del contrato y vuelve a leer las sedes', async () => {
      simularLectura();
      const lectura = renderHook(() => useSedes(CLIENTE), { wrapper: envoltorio });
      await waitFor(() => expect(lectura.result.current.isSuccess).toBe(true));
      const lecturas = llamadas('GET', '/servicios-contratados/proyecto/').length;

      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'POST' ? json(201, servicioApi) : json(200, [servicioApi]),
      );
      const { result } = renderHook(() => useCrearServicio(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync({ proyectoId: SEDE, datos: datosServicio });
      });

      const [url, init] = llamadas('POST')[0];
      expect(String(url)).toMatch(/\/api\/mantenimiento\/servicios-contratados$/);
      expect(JSON.parse(init.body)).toEqual({
        proyectoId: SEDE,
        tipoServicio: 'DRT',
        frecuencia: 'QUINCENAL',
        areaTotalM2: 1200,
        areaTratarM2: 800,
        insumosAutorizados: [INSUMO],
        equiposAutorizados: [EQUIPO],
        dosisReferencial: { [INSUMO]: '1 bloque por estación' },
        requiereCertificado: true,
        vigenciaDias: 180,
      });
      await waitFor(() => expect(llamadas('GET', '/servicios-contratados/proyecto/').length).toBeGreaterThan(lecturas));
    });

    it('edita un servicio con PATCH sin tipo ni sede', async () => {
      fetchMock.mockResolvedValue(json(200, servicioApi));
      const { result } = renderHook(() => useActualizarServicio(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync({ id: SERVICIO, datos: datosServicio });
      });

      const [url, init] = llamadas('PATCH')[0];
      expect(String(url)).toMatch(new RegExp(`/api/mantenimiento/servicios-contratados/${SERVICIO}$`));
      expect(JSON.parse(init.body)).not.toHaveProperty('tipoServicio');
      expect(JSON.parse(init.body)).not.toHaveProperty('proyectoId');
    });

    it.each([
      ['desactiva', useDesactivarServicio, 'desactivar'],
      ['activa', useActivarServicio, 'activar'],
    ])('%s un servicio por su ruta de estado', async (_nombre, usar, accion) => {
      fetchMock.mockResolvedValue(json(200, { id: SERVICIO, estado: 'INACTIVO' }));
      const { result } = renderHook(() => usar(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync(SERVICIO);
      });

      const [url] = llamadas('PATCH')[0];
      expect(String(url)).toMatch(new RegExp(`/api/mantenimiento/servicios-contratados/${SERVICIO}/${accion}$`));
    });
  });
});
