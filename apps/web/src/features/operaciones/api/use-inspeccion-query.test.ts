import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useInspeccionQuery } from './use-inspeccion-query';

describe('useInspeccionQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('devuelve null sin lanzar error cuando la API responde 200 con cuerpo vacio (BUG-07)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 200, statusText: 'OK' }) as any,
    );

    const { result } = renderHook(
      () => useInspeccionQuery('00000000-0000-0000-0000-000000000001'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('devuelve los datos de la inspeccion cuando la API responde con JSON', async () => {
    const inspeccionMock = { id: 'insp-123', estado: 'BORRADOR' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(inspeccionMock), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    );

    const { result } = renderHook(
      () => useInspeccionQuery('00000000-0000-0000-0000-000000000001'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(inspeccionMock);
  });

  it('devuelve null cuando la respuesta no es exitosa (ej. 404 o 500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Error', { status: 500, statusText: 'Internal Server Error' }) as any,
    );

    const { result } = renderHook(
      () => useInspeccionQuery('00000000-0000-0000-0000-000000000001'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
