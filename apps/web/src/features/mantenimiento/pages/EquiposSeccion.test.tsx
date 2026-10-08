import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EquiposSeccion } from './EquiposSeccion';
import { useSesion } from '../../../shared/api/sesion';
import { crearEstadoApi, equipoApi, json, llamadasA, simularApiMantenimiento } from '../pruebas/api-mantenimiento-simulada';

const fetchMock = vi.fn();
const onNuevo = vi.fn();
const onEditar = vi.fn();

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <EquiposSeccion onNuevo={onNuevo} onEditar={onEditar} />
    </QueryClientProvider>,
  );
}

describe('EquiposSeccion', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    onNuevo.mockReset();
    onEditar.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra los equipos con el tipo y el estado operativo con su etiqueta de pantalla', async () => {
    simularApiMantenimiento(
      fetchMock,
      crearEstadoApi({
        equipos: [equipoApi(1, { nombre: 'Detector de humedad', tipo: 'MEDICION', estadoOperativo: 'FUERA_SERVICIO', marcaModelo: 'Testo 606' })],
      }),
    );
    montar();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando equipos…');
    const fila = (await screen.findByText('Detector de humedad')).closest('tr') as HTMLElement;
    expect(within(fila).getByText('Medición')).toBeInTheDocument();
    expect(within(fila).getByText('Testo 606')).toBeInTheDocument();
    expect(within(fila).getByRole('combobox', { name: 'Estado operativo de Detector de humedad' })).toHaveDisplayValue('Fuera de servicio');
  });

  it('sin equipos invita a registrar el primero', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi());
    montar();

    expect(await screen.findByText('Todavía no hay equipos registrados.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }));
    expect(onNuevo).toHaveBeenCalledTimes(1);
  });

  it('un 403 muestra un aviso de permiso claro, sin controles de escritura', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ prohibido: true }));
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver los equipos.');
    expect(screen.queryByRole('button', { name: 'Nuevo equipo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('si la lectura falla por la red ofrece reintentar', async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch');
    });
    simularApiMantenimiento(fetchMock, crearEstadoApi({ equipos: [equipoApi(1)] }));
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Equipo 1')).toBeInTheDocument();
  });

  it('cambia el estado operativo con el código de la base y lo muestra al recargar la lista', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ equipos: [equipoApi(1)] }));
    montar();

    const selector = await screen.findByRole('combobox', { name: 'Estado operativo de Equipo 1' });
    fireEvent.change(selector, { target: { value: 'FUERA_SERVICIO' } });

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Estado operativo de Equipo 1' })).toHaveDisplayValue('Fuera de servicio'));
    expect(llamadasA(fetchMock, 'PATCH')[0]).toMatchObject({
      url: expect.stringMatching(/\/equipos\/11111111-0000-4000-8000-000000000001\/estado$/),
      cuerpo: { estadoOperativo: 'FUERA_SERVICIO' },
    });
  });

  it('si el cambio de estado falla lo avisa y conserva el estado anterior', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ equipos: [equipoApi(1)] }));
    const lectura = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'PATCH' ? json(403, { statusCode: 403, message: 'Forbidden resource' }) : lectura(url, init),
    );
    montar();

    fireEvent.change(await screen.findByRole('combobox', { name: 'Estado operativo de Equipo 1' }), { target: { value: 'MANTENIMIENTO' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden resource');
    expect(screen.getByRole('combobox', { name: 'Estado operativo de Equipo 1' })).toHaveDisplayValue('Operativo');
  });

  it('editar entrega el equipo completo para precargar el formulario', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ equipos: [equipoApi(1)] }));
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar equipo Equipo 1' }));

    expect(onEditar).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Equipo 1', codigoInterno: 'EQ-1' }));
  });
});
