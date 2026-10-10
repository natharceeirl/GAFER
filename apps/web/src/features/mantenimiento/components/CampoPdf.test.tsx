import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CampoPdf } from './CampoPdf';
import { useSesion } from '../../../shared/api/sesion';

const fetchMock = vi.fn();

const URL_SUBIDA = 'http://localhost:9000/gafer-docs/x.pdf?firma=1';

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

const pdf = (nombre = 'ficha.pdf') => new File(['%PDF-1.4'], nombre, { type: 'application/pdf' });

/** Comportamiento del almacenamiento: `fallos` es la cantidad de PUT que se rechazan antes de aceptar. */
function simularAlmacenamiento({ fallos = 0, retener }: { fallos?: number; retener?: Promise<void> } = {}) {
  let rechazados = 0;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === URL_SUBIDA) {
      await retener;
      if (rechazados < fallos) {
        rechazados += 1;
        return new Response('error', { status: 500 });
      }
      return new Response(null, { status: 200 });
    }
    if (String(url).endsWith('/storage/upload-url')) return json(201, { key: 'k', uploadUrl: URL_SUBIDA, bucket: 'b', expiresInSeconds: 900 });
    if (String(url).endsWith('/storage/download-url')) return json(201, { key: JSON.parse(String(init?.body)).key, downloadUrl: 'http://localhost:9000/ver.pdf', expiresInSeconds: 3600 });
    return json(404, {});
  });
}

const onSubiendo = vi.fn();

function Montaje({ inicial = '' }: { inicial?: string }) {
  const [clave, setClave] = useState(inicial);
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <CampoPdf id="ficha" etiqueta="Ficha técnica (PDF)" carpeta="ficha-tecnica" clave={clave} onCambiar={setClave} onSubiendoCambio={onSubiendo} />
      <output data-testid="clave">{clave}</output>
    </QueryClientProvider>
  );
}

const elegir = (archivo: File) => fireEvent.change(screen.getByLabelText('Ficha técnica (PDF)'), { target: { files: [archivo] } });

describe('CampoPdf', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    onSubiendo.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sin archivo avisa que falta cargarlo', () => {
    render(<Montaje />);
    expect(screen.getByText('Sin archivo cargado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver PDF/ })).toBeNull();
  });

  it('rechaza en el navegador lo que no es PDF, sin llamar al API', () => {
    simularAlmacenamiento();
    render(<Montaje />);

    elegir(new File(['x'], 'foto.png', { type: 'image/png' }));

    expect(screen.getByRole('alert')).toHaveTextContent('El archivo debe ser un PDF.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('clave')).toHaveTextContent('');
  });

  it('rechaza en el navegador un PDF demasiado grande', () => {
    simularAlmacenamiento();
    render(<Montaje />);

    elegir(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'enorme.pdf', { type: 'application/pdf' }));

    expect(screen.getByRole('alert')).toHaveTextContent('El PDF pesa más de 10 MB');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sube el PDF mostrando el avance y entrega la clave al terminar', async () => {
    let terminar = () => {};
    simularAlmacenamiento({ retener: new Promise<void>((resolver) => (terminar = resolver)) });
    render(<Montaje />);

    elegir(pdf('ficha-brodifacoum.pdf'));

    expect(await screen.findByText('Subiendo ficha-brodifacoum.pdf…')).toBeInTheDocument();
    expect(screen.getByLabelText('Ficha técnica (PDF)')).toBeDisabled();
    terminar();
    await waitFor(() => expect(screen.getByTestId('clave').textContent).toMatch(/^insumos\/ficha-tecnica\/.+\.pdf$/));
    expect(screen.getByText('Archivo cargado: ficha-brodifacoum.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Ficha técnica (PDF)')).toBeEnabled();
    expect(onSubiendo.mock.calls.map(([v]) => v)).toEqual([false, true, false]);
  });

  it('si la subida falla muestra el error y permite reintentar con el mismo archivo', async () => {
    simularAlmacenamiento({ fallos: 1 });
    render(<Montaje />);

    elegir(pdf());

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('No se pudo subir el archivo');
    expect(screen.getByTestId('clave')).toHaveTextContent('');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByTestId('clave').textContent).toMatch(/\.pdf$/));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('con un archivo ya cargado ofrece verlo y reemplazarlo', async () => {
    simularAlmacenamiento();
    const abrir = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<Montaje inicial="insumos/ficha-tecnica/previa.pdf" />);

    expect(screen.getByText('Archivo cargado.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver PDF' }));

    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ key: 'insumos/ficha-tecnica/previa.pdf' });

    elegir(pdf('nueva.pdf'));
    await waitFor(() => expect(screen.getByTestId('clave').textContent).not.toBe('insumos/ficha-tecnica/previa.pdf'));
  });

  it('si no se puede abrir el PDF lo avisa', async () => {
    fetchMock.mockImplementation(async () => json(404, { statusCode: 404, message: 'Archivo no encontrado' }));
    render(<Montaje inicial="k" />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Archivo no encontrado');
  });

  it('muestra el error del formulario sobre el campo', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CampoPdf id="ficha" etiqueta="Ficha técnica (PDF)" carpeta="ficha-tecnica" clave="" onCambiar={() => {}} error="Cargue la ficha técnica en formato PDF." />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Cargue la ficha técnica en formato PDF.')).toBeInTheDocument();
  });
});
