import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BandejaAprobacionPage } from './BandejaAprobacionPage';
import { useSesion } from '../../../shared/api/sesion';
import { json, resumenApi, simularApiDocumentos } from '../pruebas/api-documentos-simulada';

const fetchMock = vi.fn();
const onAbrir = vi.fn();

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <BandejaAprobacionPage onAbrirDocumento={onAbrir} />
    </QueryClientProvider>,
  );
}

const otro = resumenApi({
  id: 'd2222222-2222-4222-8222-222222222222',
  codigo: 'REPORTE-KALLPA-003-2026',
  tipo: 'REPORTE',
  estado: 'APROBADO',
  proyecto: null,
  fecha: '2026-11-20',
});

describe('BandejaAprobacionPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    onAbrir.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra los documentos reales con cliente, sede, tipo, estado y fecha', async () => {
    simularApiDocumentos(fetchMock, { lista: [resumenApi(), otro] });
    montar();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando documentos…');
    const fila = (await screen.findByText('INFORME-KALLPA-014-2026')).closest('button') as HTMLElement;
    expect(within(fila).getByText(/Kallpa Generación S\.A\./)).toBeInTheDocument();
    expect(within(fila).getByText(/Planta Chilca/)).toBeInTheDocument();
    expect(within(fila).getByText('En revisión')).toBeInTheDocument();
    expect(within(fila).getByText('2026-11-24')).toBeInTheDocument();
    expect(screen.getByText(/Sin sede/)).toBeInTheDocument();
    expect(screen.getByText('1 pendientes')).toBeInTheDocument();
  });

  it('el filtro por estado muestra solo los de ese estado', async () => {
    simularApiDocumentos(fetchMock, { lista: [resumenApi(), otro] });
    montar();
    await screen.findByText('INFORME-KALLPA-014-2026');

    fireEvent.click(screen.getByRole('tab', { name: 'Aprobado' }));

    expect(screen.queryByText('INFORME-KALLPA-014-2026')).toBeNull();
    expect(screen.getByText('REPORTE-KALLPA-003-2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Observado' }));
    expect(screen.getByText('Ningún documento en este estado.')).toBeInTheDocument();
  });

  it('abrir una fila entrega el id del documento', async () => {
    simularApiDocumentos(fetchMock, { lista: [resumenApi()] });
    montar();
    fireEvent.click((await screen.findByText('INFORME-KALLPA-014-2026')).closest('button') as HTMLElement);
    expect(onAbrir).toHaveBeenCalledWith('d1111111-1111-4111-8111-111111111111');
  });

  it('sin documentos lo dice con claridad', async () => {
    simularApiDocumentos(fetchMock, { lista: [] });
    montar();
    expect(await screen.findByText('Todavía no hay documentos registrados.')).toBeInTheDocument();
  });

  it('un error del servidor ofrece reintentar y recupera la lista', async () => {
    fetchMock.mockResolvedValueOnce(json(500, { message: 'boom' }));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo completar la operación.');

    simularApiDocumentos(fetchMock, { lista: [resumenApi()] });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('INFORME-KALLPA-014-2026')).toBeInTheDocument();
  });

  it('un 403 indica que no hay permiso, sin ofrecer reintentar', async () => {
    fetchMock.mockResolvedValue(json(403, { message: 'Forbidden resource' }));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver los documentos.');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
