import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfiguracionSeccion } from './ConfiguracionSeccion';
import { useSesion } from '../../../shared/api/sesion';
import { configuracionApi, crearEstadoApi, json, llamadasA, simularApiMantenimiento, type EstadoApi } from '../pruebas/api-mantenimiento-simulada';

const fetchMock = vi.fn();

function montar(estado: EstadoApi, soloLectura = false) {
  simularApiMantenimiento(fetchMock, estado);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ConfiguracionSeccion soloLectura={soloLectura} />
    </QueryClientProvider>,
  );
}

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

describe('ConfiguracionSeccion', () => {
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

  it('el Administrador ve el formulario con el Director Técnico y la resolución del API', async () => {
    montar(crearEstadoApi());

    expect(screen.getByRole('status')).toHaveTextContent('Cargando configuración…');
    expect(await screen.findByLabelText('Nombre completo')).toHaveValue('Ing. Carlos Medina Ruiz');
    expect(screen.getByLabelText('N° de CIP')).toHaveValue('84512');
    expect(screen.getByLabelText('Resolución sanitaria de GAFER')).toHaveValue('0023-2024-DESA/MINSA');
  });

  it('guarda con PATCH, avisa y el servidor devuelve el director nuevo', async () => {
    montar(crearEstadoApi());
    await screen.findByLabelText('Nombre completo');

    escribir('Nombre completo', 'Ing. Ana Paz Soto');
    escribir('N° de CIP', '12345');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(await screen.findByText(/Configuración actualizada/)).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'PATCH')[0].cuerpo).toEqual({
      director: { nombre: 'Ing. Ana Paz Soto', cip: '12345', firma: null },
      resolucionSanitaria: '0023-2024-DESA/MINSA',
    });
  });

  it('el CIP solo admite dígitos y se exigen de 4 a 7', async () => {
    montar(crearEstadoApi());
    await screen.findByLabelText('Nombre completo');

    escribir('N° de CIP', 'ab12');
    expect(screen.getByLabelText('N° de CIP')).toHaveValue('12');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(screen.getByText('El CIP debe contener entre 4 y 7 dígitos numéricos')).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'PATCH')).toHaveLength(0);
  });

  it('carga la firma como imagen, la muestra y la manda como data URL', async () => {
    montar(crearEstadoApi());
    await screen.findByLabelText('Nombre completo');

    fireEvent.change(screen.getByLabelText('Firma gráfica'), { target: { files: [new File([new Uint8Array([137, 80, 78, 71])], 'firma.png', { type: 'image/png' })] } });

    expect(await screen.findByAltText('Firma cargada del Director Técnico')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() => expect(llamadasA(fetchMock, 'PATCH')).toHaveLength(1));
    expect((llamadasA(fetchMock, 'PATCH')[0].cuerpo as { director: { firma: string } }).director.firma).toMatch(/^data:image\/png;base64,/);
  });

  it('rechaza una firma que no es PNG ni JPG', async () => {
    montar(crearEstadoApi());
    await screen.findByLabelText('Nombre completo');

    fireEvent.change(screen.getByLabelText('Firma gráfica'), { target: { files: [new File(['x'], 'firma.pdf', { type: 'application/pdf' })] } });

    expect(screen.getByText('La firma debe ser una imagen PNG o JPG.')).toBeInTheDocument();
    expect(screen.queryByAltText('Firma cargada del Director Técnico')).toBeNull();
  });

  it('permite quitar la firma cargada', async () => {
    montar(crearEstadoApi({ configuracion: configuracionApi({ director: { nombre: 'Ing. Ana', cip: '12345', firma: 'data:image/png;base64,AAAA' } }) }));
    await screen.findByAltText('Firma cargada del Director Técnico');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar firma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    await waitFor(() => expect(llamadasA(fetchMock, 'PATCH')).toHaveLength(1));
    expect((llamadasA(fetchMock, 'PATCH')[0].cuerpo as { director: { firma: null } }).director.firma).toBeNull();
  });

  it('muestra el error del servidor sobre su campo', async () => {
    montar(crearEstadoApi());
    const lectura = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'PATCH'
        ? json(400, { statusCode: 400, message: ['x'], errors: [{ path: 'resolucionSanitaria', message: 'Resolución no válida' }] })
        : lectura(url, init),
    );
    await screen.findByLabelText('Nombre completo');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(await screen.findByText('Resolución no válida')).toBeInTheDocument();
  });

  it('el Supervisor solo lee: sin campos editables ni botón de guardar', async () => {
    montar(crearEstadoApi({ rol: 'SUPERVISOR' }), true);

    expect(await screen.findByText('Ing. Carlos Medina Ruiz')).toBeInTheDocument();
    expect(screen.getByText('84512')).toBeInTheDocument();
    expect(screen.getByText('0023-2024-DESA/MINSA')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar configuración' })).toBeNull();
    expect(screen.getByText(/Solo el Administrador puede modificarla/)).toBeInTheDocument();
  });

  it('si la lectura falla ofrece reintentar', async () => {
    fetchMock.mockImplementationOnce(async () => json(500, { statusCode: 500 }));
    montar(crearEstadoApi());

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo completar la operación');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Nombre completo')).toBeInTheDocument();
  });
});
