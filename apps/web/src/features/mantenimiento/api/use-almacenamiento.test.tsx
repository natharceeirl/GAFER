import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAbrirPdf, useSubirPdf } from './use-almacenamiento';
import { useSesion } from '../../../shared/api/sesion';

const fetchMock = vi.fn();

const URL_SUBIDA = 'http://localhost:9000/gafer-docs/insumos/ficha-tecnica/x.pdf?X-Amz-Signature=abc';
const URL_BAJADA = 'http://localhost:9000/gafer-docs/insumos/ficha-tecnica/x.pdf?X-Amz-Signature=def';

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

const pdf = () => new File(['%PDF-1.4'], 'ficha.pdf', { type: 'application/pdf' });

let cliente: QueryClient;
const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

describe('almacenamiento de fichas técnicas y MSDS', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
    cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('useSubirPdf', () => {
    it('pide la URL prefirmada, sube el archivo con PUT y devuelve la clave a guardar en el insumo', async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url === URL_SUBIDA ? new Response(null, { status: 200 }) : json(201, { key: 'k', uploadUrl: URL_SUBIDA, bucket: 'gafer-docs', expiresInSeconds: 900 }),
      );
      const { result } = renderHook(() => useSubirPdf(), { wrapper: envoltorio });
      const archivo = pdf();

      let clave = '';
      await act(async () => {
        clave = await result.current.mutateAsync({ archivo, carpeta: 'ficha-tecnica' });
      });

      expect(clave).toMatch(/^insumos\/ficha-tecnica\/[0-9a-f-]{36}\.pdf$/);
      const [primera, segunda] = fetchMock.mock.calls;
      expect(String(primera[0])).toMatch(/\/api\/mantenimiento\/storage\/upload-url$/);
      expect(primera[1].method).toBe('POST');
      expect(JSON.parse(primera[1].body)).toEqual({ key: clave, contentType: 'application/pdf' });
      expect(primera[1].headers.Authorization).toBe('Bearer jwt');
      expect(segunda[0]).toBe(URL_SUBIDA);
      expect(segunda[1].method).toBe('PUT');
      expect(segunda[1].body).toBe(archivo);
      expect(segunda[1].headers['Content-Type']).toBe('application/pdf');
      // La URL prefirmada ya lleva la firma: no se le agrega la sesión del API.
      expect(segunda[1].headers.Authorization).toBeUndefined();
    });

    it('si el almacenamiento rechaza el PUT falla con un mensaje claro', async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url === URL_SUBIDA ? new Response('denegado', { status: 403 }) : json(201, { key: 'k', uploadUrl: URL_SUBIDA, bucket: 'b', expiresInSeconds: 900 }),
      );
      const { result } = renderHook(() => useSubirPdf(), { wrapper: envoltorio });

      await act(async () => {
        await expect(result.current.mutateAsync({ archivo: pdf(), carpeta: 'hoja-msds' })).rejects.toThrow(/No se pudo subir el archivo/);
      });
    });

    it('si falla la conexión con el almacenamiento falla con el mensaje de red', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === URL_SUBIDA) throw new TypeError('Failed to fetch');
        return json(201, { key: 'k', uploadUrl: URL_SUBIDA, bucket: 'b', expiresInSeconds: 900 });
      });
      const { result } = renderHook(() => useSubirPdf(), { wrapper: envoltorio });

      await act(async () => {
        await expect(result.current.mutateAsync({ archivo: pdf(), carpeta: 'ficha-tecnica' })).rejects.toMatchObject({ tipo: 'red' });
      });
    });

    it('si el API no entrega la URL (403) no intenta subir nada', async () => {
      fetchMock.mockResolvedValue(json(403, { statusCode: 403, message: 'Forbidden resource' }));
      const { result } = renderHook(() => useSubirPdf(), { wrapper: envoltorio });

      await act(async () => {
        await expect(result.current.mutateAsync({ archivo: pdf(), carpeta: 'ficha-tecnica' })).rejects.toMatchObject({ tipo: 'prohibido' });
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('useAbrirPdf', () => {
    it('pide la URL de descarga de la clave y abre el PDF en otra pestaña', async () => {
      fetchMock.mockResolvedValue(json(201, { key: 'insumos/ficha-tecnica/x.pdf', downloadUrl: URL_BAJADA, expiresInSeconds: 3600 }));
      const abrir = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.href).toBe(URL_BAJADA);
        expect(this.target).toBe('_blank');
        expect(this.rel).toContain('noopener');
      });
      const { result } = renderHook(() => useAbrirPdf(), { wrapper: envoltorio });

      await act(() => result.current.mutateAsync('insumos/ficha-tecnica/x.pdf'));

      expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mantenimiento\/storage\/download-url$/);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ key: 'insumos/ficha-tecnica/x.pdf' });
      expect(abrir).toHaveBeenCalledTimes(1);
    });

    it('si no se pudo obtener la URL no abre nada y deja el error', async () => {
      fetchMock.mockResolvedValue(json(404, { statusCode: 404, message: 'x' }));
      const abrir = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const { result } = renderHook(() => useAbrirPdf(), { wrapper: envoltorio });

      await act(async () => {
        await expect(result.current.mutateAsync('k')).rejects.toMatchObject({ tipo: 'no-encontrado' });
      });
      expect(abrir).not.toHaveBeenCalled();
    });
  });
});
