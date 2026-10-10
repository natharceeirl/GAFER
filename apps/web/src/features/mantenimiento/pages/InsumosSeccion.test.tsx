import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InsumosSeccion } from './InsumosSeccion';
import { useSesion } from '../../../shared/api/sesion';
import { crearEstadoApi, insumoApi, json, llamadasA, simularApiMantenimiento } from '../pruebas/api-mantenimiento-simulada';

const fetchMock = vi.fn();
const onNuevo = vi.fn();
const onEditar = vi.fn();

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <InsumosSeccion onNuevo={onNuevo} onEditar={onEditar} />
    </QueryClientProvider>,
  );
}

describe('InsumosSeccion', () => {
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
    vi.restoreAllMocks();
  });

  it('muestra "cargando" y luego los insumos del API con las etiquetas de pantalla', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ insumos: [insumoApi(1, { nombreComercial: 'Cipermetrina 25% EC', presentacion: 'LIQUIDO' })] }));
    montar();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando insumos…');
    const fila = (await screen.findByText('Cipermetrina 25% EC')).closest('tr') as HTMLElement;
    expect(within(fila).getByText('Líquido')).toBeInTheDocument();
    expect(within(fila).getByText('Activo')).toBeInTheDocument();
    expect(within(fila).getByText('DIG-1')).toBeInTheDocument();
  });

  it('sin insumos invita a registrar el primero', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi());
    montar();

    expect(await screen.findByText('Todavía no hay insumos registrados.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo insumo' }));
    expect(onNuevo).toHaveBeenCalledTimes(1);
  });

  it('si la lectura falla muestra el error y reintenta', async () => {
    fetchMock.mockImplementationOnce(async () => json(500, { statusCode: 500 }));
    simularApiMantenimiento(fetchMock, crearEstadoApi({ insumos: [insumoApi(1)] }));
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo completar la operación');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Insumo 1')).toBeInTheDocument();
  });

  it('un 403 muestra un aviso de permiso claro, sin botón de reintentar ni de crear', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ prohibido: true }));
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver los insumos.');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nuevo insumo' })).toBeNull();
  });

  it('editar entrega el insumo completo para precargar el formulario', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ insumos: [insumoApi(1)] }));
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar insumo Insumo 1' }));

    expect(onEditar).toHaveBeenCalledWith(expect.objectContaining({ nombreComercial: 'Insumo 1', registroDigesa: 'DIG-1' }));
  });

  it('desactiva un insumo y la lista lo refleja; luego lo vuelve a activar', async () => {
    const estado = crearEstadoApi({ insumos: [insumoApi(1)] });
    simularApiMantenimiento(fetchMock, estado);
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar insumo Insumo 1' }));

    expect(await screen.findByRole('button', { name: 'Activar insumo Insumo 1' })).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'PATCH')[0].url).toMatch(/\/insumos\/00000000-0000-4000-8000-000000000001\/desactivar$/);

    fireEvent.click(screen.getByRole('button', { name: 'Activar insumo Insumo 1' }));
    expect(await screen.findByRole('button', { name: 'Desactivar insumo Insumo 1' })).toBeInTheDocument();
  });

  it('mientras cambia el estado deshabilita los botones de la fila', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ insumos: [insumoApi(1)] }));
    const lectura = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    let terminar = () => {};
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PATCH') await new Promise<void>((resolver) => (terminar = resolver));
      return lectura(url, init);
    });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar insumo Insumo 1' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Desactivar insumo Insumo 1' })).toBeDisabled());
    terminar();
    await screen.findByRole('button', { name: 'Activar insumo Insumo 1' });
  });

  it('si el cambio de estado falla lo avisa sin perder la lista', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ insumos: [insumoApi(1)] }));
    const lectura = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'PATCH' ? json(403, { statusCode: 403, message: 'Forbidden resource' }) : lectura(url, init),
    );
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar insumo Insumo 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden resource');
    expect(screen.getByText('Insumo 1')).toBeInTheDocument();
  });

  it('abre la ficha técnica y la MSDS con una URL de descarga prefirmada de cada clave', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ insumos: [insumoApi(1)] }));
    const abiertos: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      abiertos.push(this.href);
    });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver ficha técnica de Insumo 1' }));
    await waitFor(() => expect(abiertos).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Ver hoja MSDS de Insumo 1' }));
    await waitFor(() => expect(abiertos).toHaveLength(2));

    expect(llamadasA(fetchMock, 'POST', '/storage/download-url').map((l) => l.cuerpo)).toEqual([
      { key: 'insumos/ficha-tecnica/1.pdf' },
      { key: 'insumos/hoja-msds/1.pdf' },
    ]);
    expect(abiertos[0]).toContain('almacenamiento.prueba/ver/');
  });

  it('si no se puede abrir un PDF lo avisa', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ insumos: [insumoApi(1)] }));
    const lectura = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      String(url).endsWith('/storage/download-url') ? json(404, { statusCode: 404, message: 'Archivo no encontrado' }) : lectura(url, init),
    );
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver ficha técnica de Insumo 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Archivo no encontrado');
  });
});
