import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogosTextoSeccion } from './CatalogosTextoSeccion';
import { useSesion } from '../../../shared/api/sesion';
import { catalogoApi, crearEstadoApi, json, llamadasA, simularApiMantenimiento, type EstadoApi } from '../pruebas/api-mantenimiento-simulada';

const fetchMock = vi.fn();

const catalogos = () => [
  catalogoApi('giros', 'Giros de negocio', ['Energía', 'Alimentos']),
  catalogoApi('motivos-modificacion', 'Motivos de modificación', ['Error de digitación'], true),
];

function montar(estado: EstadoApi) {
  simularApiMantenimiento(fetchMock, estado);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <CatalogosTextoSeccion />
    </QueryClientProvider>,
  );
}

const tarjeta = (titulo: string) => screen.getByRole('heading', { name: titulo }).closest('.mant-catalogo') as HTMLElement;

describe('CatalogosTextoSeccion', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('el Administrador ve todos los catálogos, incluidos los solo de Administrador', async () => {
    montar(crearEstadoApi({ catalogos: catalogos() }));

    expect(screen.getByRole('status')).toHaveTextContent('Cargando catálogos…');
    expect(await screen.findByRole('heading', { name: 'Giros de negocio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Motivos de modificación' })).toBeInTheDocument();
    expect(within(tarjeta('Giros de negocio')).getByText('Energía')).toBeInTheDocument();
  });

  it('el Supervisor no ve el catálogo de motivos (el API no se lo entrega)', async () => {
    montar(crearEstadoApi({ catalogos: catalogos(), rol: 'SUPERVISOR' }));

    expect(await screen.findByRole('heading', { name: 'Giros de negocio' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Motivos de modificación' })).toBeNull();
  });

  it('aclara que editar un catálogo no cambia lo ya registrado', async () => {
    montar(crearEstadoApi({ catalogos: catalogos() }));
    expect(await screen.findByText(/no alteran lo ya registrado/)).toBeInTheDocument();
  });

  it('agrega un texto: POST al catálogo y aparece en la lista', async () => {
    const estado = crearEstadoApi({ catalogos: catalogos() });
    montar(estado);

    await screen.findByRole('heading', { name: 'Giros de negocio' });
    const giros = tarjeta('Giros de negocio');
    fireEvent.change(within(giros).getByLabelText('Nuevo texto en Giros de negocio'), { target: { value: ' Minería ' } });
    fireEvent.click(within(giros).getByRole('button', { name: 'Agregar' }));

    expect(await within(giros).findByText('Minería')).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'POST')[0]).toMatchObject({ url: expect.stringMatching(/\/catalogos-texto\/giros\/items$/), cuerpo: { item: 'Minería' } });
    expect(within(giros).getByLabelText('Nuevo texto en Giros de negocio')).toHaveValue('');
  });

  it('agregar con Enter también funciona', async () => {
    montar(crearEstadoApi({ catalogos: catalogos() }));
    await screen.findByRole('heading', { name: 'Giros de negocio' });
    const campo = within(tarjeta('Giros de negocio')).getByLabelText('Nuevo texto en Giros de negocio');

    fireEvent.change(campo, { target: { value: 'Minería' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByText('Minería')).toBeInTheDocument();
  });

  it('no envía un texto vacío ni repetido y lo dice', async () => {
    montar(crearEstadoApi({ catalogos: catalogos() }));
    await screen.findByRole('heading', { name: 'Giros de negocio' });
    const giros = tarjeta('Giros de negocio');

    fireEvent.click(within(giros).getByRole('button', { name: 'Agregar' }));
    expect(within(giros).getByRole('alert')).toHaveTextContent('Escriba el texto que desea agregar.');

    fireEvent.change(within(giros).getByLabelText('Nuevo texto en Giros de negocio'), { target: { value: 'energía' } });
    fireEvent.click(within(giros).getByRole('button', { name: 'Agregar' }));
    expect(within(giros).getByRole('alert')).toHaveTextContent('Ese texto ya está en el catálogo.');
    expect(llamadasA(fetchMock, 'POST')).toHaveLength(0);
  });

  it('edita un texto: PUT con la lista completa y el texto reemplazado en su lugar', async () => {
    const estado = crearEstadoApi({ catalogos: catalogos() });
    montar(estado);
    await screen.findByRole('heading', { name: 'Giros de negocio' });
    const giros = tarjeta('Giros de negocio');

    fireEvent.click(within(giros).getByRole('button', { name: 'Editar Energía' }));
    fireEvent.change(within(giros).getByLabelText('Texto de Energía'), { target: { value: 'Energía y minería' } });
    fireEvent.click(within(giros).getByRole('button', { name: 'Guardar' }));

    expect(await within(giros).findByText('Energía y minería')).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'PUT')[0].cuerpo).toEqual({ items: ['Energía y minería', 'Alimentos'] });
  });

  it('cancelar la edición de un texto no envía nada', async () => {
    montar(crearEstadoApi({ catalogos: catalogos() }));
    await screen.findByRole('heading', { name: 'Giros de negocio' });
    const giros = tarjeta('Giros de negocio');

    fireEvent.click(within(giros).getByRole('button', { name: 'Editar Energía' }));
    fireEvent.click(within(giros).getByRole('button', { name: 'Cancelar' }));

    expect(within(giros).getByText('Energía')).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'PUT')).toHaveLength(0);
  });

  it('quita un texto: PUT sin ese texto', async () => {
    montar(crearEstadoApi({ catalogos: catalogos() }));
    await screen.findByRole('heading', { name: 'Giros de negocio' });
    const giros = tarjeta('Giros de negocio');

    fireEvent.click(within(giros).getByRole('button', { name: 'Quitar Alimentos' }));

    await vi.waitFor(() => expect(within(giros).queryByText('Alimentos')).toBeNull());
    expect(llamadasA(fetchMock, 'PUT')[0].cuerpo).toEqual({ items: ['Energía'] });
  });

  it('si el servidor rechaza el cambio lo muestra en la tarjeta y conserva la lista', async () => {
    montar(crearEstadoApi({ catalogos: catalogos() }));
    const lectura = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'POST' ? json(403, { statusCode: 403, message: 'Forbidden resource' }) : lectura(url, init),
    );
    await screen.findByRole('heading', { name: 'Giros de negocio' });
    const giros = tarjeta('Giros de negocio');

    fireEvent.change(within(giros).getByLabelText('Nuevo texto en Giros de negocio'), { target: { value: 'Minería' } });
    fireEvent.click(within(giros).getByRole('button', { name: 'Agregar' }));

    expect(await within(giros).findByRole('alert')).toHaveTextContent('Forbidden resource');
    expect(within(giros).getByText('Energía')).toBeInTheDocument();
    expect(within(giros).queryByText('Minería')).toBeNull();
  });

  it('si la lectura falla ofrece reintentar', async () => {
    fetchMock.mockImplementationOnce(async () => json(500, { statusCode: 500 }));
    montar(crearEstadoApi({ catalogos: catalogos() }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo completar la operación');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Giros de negocio' })).toBeInTheDocument();
  });
});
