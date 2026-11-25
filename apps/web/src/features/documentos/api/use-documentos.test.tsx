import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDescargarPdf, useDocumento, useDocumentosLista, useSolicitarPdf, useTransicionarDocumento } from './use-documentos';
import { useSesion } from '../../../shared/api/sesion';

const fetchMock = vi.fn();
const ID = 'd1111111-1111-4111-8111-111111111111';

const resumen = {
  id: ID,
  codigo: 'INFORME-KALLPA-014-2026',
  clienteId: 'a1111111-1111-4111-8111-111111111111',
  cliente: 'Kallpa Generación S.A.',
  proyecto: null,
  tipo: 'INFORME',
  numeroCorrelativo: 14,
  estado: 'ENVIADO_A_REVISION',
  fecha: '2026-11-24',
};
const detalle = (pdf = { estado: null, generadoAt: null, error: null }, estado = 'ENVIADO_A_REVISION') => ({ ...resumen, estado, transiciones: [], pdf });

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}
function llamadas(metodo: string, sufijo?: string) {
  return fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === metodo && (!sufijo || String(url).endsWith(sufijo)));
}

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('hooks de documentos', () => {
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

  describe('useDocumentosLista', () => {
    it('lista los documentos y los traduce a filas de bandeja', async () => {
      fetchMock.mockResolvedValue(json(200, [resumen]));
      const { result } = renderHook(() => useDocumentosLista(), { wrapper: envoltorio });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/documentos$/);
      expect(result.current.data).toEqual([expect.objectContaining({ id: ID, proyecto: 'Sin sede' })]);
    });

    it('envía los filtros como parámetros de consulta', async () => {
      fetchMock.mockResolvedValue(json(200, []));
      const { result } = renderHook(() => useDocumentosLista({ estado: 'APROBADO', tipo: 'INFORME' }), { wrapper: envoltorio });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/documentos\?estado=APROBADO&tipo=INFORME$/);
    });

    it('un 403 queda como error tipado', async () => {
      fetchMock.mockResolvedValue(json(403, { message: 'Sin permiso' }));
      const { result } = renderHook(() => useDocumentosLista(), { wrapper: envoltorio });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ tipo: 'prohibido' });
    });
  });

  describe('useDocumento', () => {
    it('trae el detalle con historial y estado del PDF', async () => {
      fetchMock.mockResolvedValue(json(200, detalle({ estado: 'ERROR', generadoAt: null, error: 'Sin conexión con el almacén' })));
      const { result } = renderHook(() => useDocumento(ID), { wrapper: envoltorio });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(String(fetchMock.mock.calls[0][0])).toMatch(new RegExp(`/api/documentos/${ID}$`));
      expect(result.current.data?.pdf).toEqual({ estado: 'ERROR', generadoAt: null, error: 'Sin conexión con el almacén' });
    });

    it('sin identificador no consulta', () => {
      renderHook(() => useDocumento(null), { wrapper: envoltorio });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('vuelve a consultar mientras el PDF está pendiente o generándose', async () => {
      fetchMock
        .mockResolvedValueOnce(json(200, detalle({ estado: 'PENDIENTE', generadoAt: null, error: null })))
        .mockResolvedValue(json(200, detalle({ estado: 'GENERADO', generadoAt: '2026-11-24T15:00:00.000Z', error: null })));
      const { result } = renderHook(() => useDocumento(ID, { intervaloPdfMs: 10 }), { wrapper: envoltorio });
      await waitFor(() => expect(result.current.data?.pdf.estado).toBe('GENERADO'));
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('useTransicionarDocumento', () => {
    it('envía el nuevo estado y el motivo e invalida lista y detalle', async () => {
      let estado = 'ENVIADO_A_REVISION';
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          estado = 'APROBADO';
          return json(200, { id: ID, estado });
        }
        if (String(url).endsWith(ID)) return json(200, detalle(undefined, estado));
        return json(200, [{ ...resumen, estado }]);
      });
      const lista = renderHook(() => useDocumentosLista(), { wrapper: envoltorio });
      const ficha = renderHook(() => useDocumento(ID), { wrapper: envoltorio });
      await waitFor(() => expect(ficha.result.current.data?.fila.estado).toBe('ENVIADO_A_REVISION'));
      const { result } = renderHook(() => useTransicionarDocumento(), { wrapper: envoltorio });

      await act(async () => {
        await result.current.mutateAsync({ id: ID, nuevoEstado: 'APROBADO', motivo: 'Todo conforme' });
      });

      const [post] = llamadas('POST');
      expect(String(post[0])).toMatch(new RegExp(`/api/documentos/${ID}/transicion$`));
      expect(JSON.parse(post[1].body)).toEqual({ nuevoEstado: 'APROBADO', motivo: 'Todo conforme' });
      await waitFor(() => expect(ficha.result.current.data?.fila.estado).toBe('APROBADO'));
      await waitFor(() => expect(lista.result.current.data?.[0].estado).toBe('APROBADO'));
    });

    it('omite el motivo vacío', async () => {
      fetchMock.mockResolvedValue(json(200, { id: ID, estado: 'APROBADO' }));
      const { result } = renderHook(() => useTransicionarDocumento(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync({ id: ID, nuevoEstado: 'APROBADO', motivo: '  ' });
      });
      expect(JSON.parse(llamadas('POST')[0][1].body)).toEqual({ nuevoEstado: 'APROBADO' });
    });

    it('una transición no permitida (400) queda como error con el mensaje del API', async () => {
      fetchMock.mockResolvedValue(json(400, { message: 'Transición no permitida' }));
      const { result } = renderHook(() => useTransicionarDocumento(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync({ id: ID, nuevoEstado: 'APROBADO' }).catch(() => undefined);
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ tipo: 'validacion', message: 'Transición no permitida' });
    });
  });

  describe('useSolicitarPdf', () => {
    it('llama a POST …/pdf y refresca el detalle', async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
        init?.method === 'POST' ? json(202, { id: ID, pdfEstado: 'PENDIENTE' }) : json(200, detalle({ estado: 'PENDIENTE', generadoAt: null, error: null }, 'APROBADO')),
      );
      const ficha = renderHook(() => useDocumento(ID), { wrapper: envoltorio });
      await waitFor(() => expect(ficha.result.current.isSuccess).toBe(true));
      const { result } = renderHook(() => useSolicitarPdf(), { wrapper: envoltorio });

      await act(async () => {
        await result.current.mutateAsync(ID);
      });

      expect(String(llamadas('POST')[0][0])).toMatch(new RegExp(`/api/documentos/${ID}/pdf$`));
      await waitFor(() => expect(llamadas('GET', ID)).toHaveLength(2));
    });
  });

  describe('useDescargarPdf', () => {
    it('descarga el archivo con el Bearer y lo entrega como Blob', async () => {
      fetchMock.mockResolvedValue(new Response('%PDF-1.4', { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
      const { result } = renderHook(() => useDescargarPdf(), { wrapper: envoltorio });
      let blob: Blob | undefined;
      await act(async () => {
        blob = await result.current.mutateAsync(ID);
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toMatch(new RegExp(`/api/documentos/${ID}/pdf$`));
      expect(init.headers.Authorization).toBe('Bearer jwt');
      expect(blob).toBeInstanceOf(Blob);
    });

    it('un 409 explica por qué no se puede descargar', async () => {
      fetchMock.mockResolvedValue(json(409, { message: 'El PDF todavía no está generado' }));
      const { result } = renderHook(() => useDescargarPdf(), { wrapper: envoltorio });
      await act(async () => {
        await result.current.mutateAsync(ID).catch(() => undefined);
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ tipo: 'conflicto', message: 'El PDF todavía no está generado' });
    });
  });
});
