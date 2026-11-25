import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentoDetailPage } from './DocumentoDetailPage';
import { useSesion } from '../../../shared/api/sesion';
import { detalleApi, ID_DOC, json, llamadasApi, simularApiDocumentos } from '../pruebas/api-documentos-simulada';

const fetchMock = vi.fn();
const onVolver = vi.fn();
const guardar = vi.fn();

function montar(rol: 'ADMINISTRADOR' | 'SUPERVISOR' = 'SUPERVISOR') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <DocumentoDetailPage id={ID_DOC} rol={rol} onVolver={onVolver} guardarArchivo={guardar} />
    </QueryClientProvider>,
  );
}

const aprobado = (pdf = {}) => detalleApi({ estado: 'APROBADO' }, pdf);

describe('DocumentoDetailPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    onVolver.mockReset();
    guardar.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra el detalle y el historial de transiciones', async () => {
    simularApiDocumentos(fetchMock);
    montar();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando documento…');
    expect(await screen.findByText('INFORME-KALLPA-014-2026')).toBeInTheDocument();
    expect(screen.getByText(/Kallpa Generación S\.A\. · Planta Chilca/)).toBeInTheDocument();
    const historial = screen.getByRole('list', { name: 'Historial de estados' });
    const items = within(historial).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Borrador');
    expect(items[0]).toHaveTextContent('TEC.UNO');
    expect(items[0]).toHaveTextContent('Técnico Operador');
    expect(items[1]).toHaveTextContent('Cerrado → En revisión');
    expect(items[1]).toHaveTextContent('Listo para revisión');
  });

  it('un error de lectura ofrece reintentar', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { message: 'Documento no encontrado' }));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Documento no encontrado');

    simularApiDocumentos(fetchMock);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('INFORME-KALLPA-014-2026')).toBeInTheDocument();
  });

  it('volver a la bandeja', async () => {
    simularApiDocumentos(fetchMock);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Bandeja de documentos/ }));
    expect(onVolver).toHaveBeenCalled();
  });

  describe('aprobación', () => {
    it('aprobar llama a la transición con el motivo y refleja el nuevo estado', async () => {
      simularApiDocumentos(fetchMock);
      montar();
      fireEvent.click(await screen.findByRole('button', { name: 'Aprobar documento' }));
      fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'Todo conforme' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));

      expect(await screen.findByText('Documento aprobado.')).toBeInTheDocument();
      const [post] = llamadasApi(fetchMock, 'POST', '/transicion');
      expect(JSON.parse(post[1].body)).toEqual({ nuevoEstado: 'APROBADO', motivo: 'Todo conforme' });
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprobar documento' })).toBeNull());
      expect(screen.getByRole('button', { name: 'Generar PDF' })).toBeInTheDocument();
    });

    it('cancelar vuelve sin llamar al API', async () => {
      simularApiDocumentos(fetchMock);
      montar();
      fireEvent.click(await screen.findByRole('button', { name: 'Aprobar documento' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('button', { name: 'Aprobar documento' })).toBeInTheDocument();
      expect(llamadasApi(fetchMock, 'POST', '/transicion')).toHaveLength(0);
    });

    it('si el API rechaza la transición muestra su mensaje', async () => {
      simularApiDocumentos(fetchMock, { transicion: json(400, { message: 'Transición no permitida: de CERRADO a APROBADO' }) });
      montar();
      fireEvent.click(await screen.findByRole('button', { name: 'Aprobar documento' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Transición no permitida: de CERRADO a APROBADO');
    });

    it('solo un documento en revisión se puede aprobar', async () => {
      simularApiDocumentos(fetchMock, { detalle: aprobado() });
      montar();
      await screen.findByText('INFORME-KALLPA-014-2026');
      expect(screen.queryByRole('button', { name: 'Aprobar documento' })).toBeNull();
    });

    it('un borrador explica que el técnico aún no lo envía a revisión', async () => {
      simularApiDocumentos(fetchMock, { detalle: detalleApi({ estado: 'BORRADOR' }) });
      montar();
      expect(await screen.findByText(/todavía no lo ha enviado a revisión/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aprobar documento' })).toBeNull();
    });
  });

  describe('estado del PDF', () => {
    it('antes de la aprobación explica que aún no se genera', async () => {
      simularApiDocumentos(fetchMock);
      montar();
      const pdf = (await screen.findByRole('heading', { name: 'PDF del informe' })).closest('section') as HTMLElement;
      expect(within(pdf).getByText('Se genera cuando el documento está aprobado.')).toBeInTheDocument();
      expect(within(pdf).queryByRole('button')).toBeNull();
    });

    it('aprobado y sin PDF permite generarlo', async () => {
      simularApiDocumentos(fetchMock, { detalle: aprobado() });
      montar();
      const pdf = (await screen.findByRole('heading', { name: 'PDF del informe' })).closest('section') as HTMLElement;
      expect(within(pdf).getByText('Sin generar')).toBeInTheDocument();
      fireEvent.click(within(pdf).getByRole('button', { name: 'Generar PDF' }));
      expect(await within(pdf).findByText('Pendiente')).toBeInTheDocument();
      expect(llamadasApi(fetchMock, 'POST', '/pdf')).toHaveLength(1);
    });

    it.each([
      ['PENDIENTE', 'Pendiente'],
      ['GENERANDO', 'Generando'],
    ] as const)('%s no ofrece acciones y avisa que se está preparando', async (estado, etiqueta) => {
      simularApiDocumentos(fetchMock, { detalle: aprobado({ estado }) });
      montar();
      const pdf = (await screen.findByRole('heading', { name: 'PDF del informe' })).closest('section') as HTMLElement;
      expect(within(pdf).getByText(etiqueta)).toBeInTheDocument();
      expect(within(pdf).getByText(/se está preparando/)).toBeInTheDocument();
      expect(within(pdf).queryByRole('button')).toBeNull();
    });

    it('GENERADO permite descargar el PDF', async () => {
      simularApiDocumentos(fetchMock, { detalle: aprobado({ estado: 'GENERADO', generadoAt: '2026-11-24T20:00:00.000Z' }) });
      montar();
      const pdf = (await screen.findByRole('heading', { name: 'PDF del informe' })).closest('section') as HTMLElement;
      expect(within(pdf).getByText('Generado')).toBeInTheDocument();
      fireEvent.click(within(pdf).getByRole('button', { name: 'Descargar PDF' }));
      await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
      expect(guardar.mock.calls[0][0]).toBeInstanceOf(Blob);
      expect(guardar.mock.calls[0][1]).toBe('INFORME-KALLPA-014-2026.pdf');
    });

    it('si la descarga responde 409 muestra el motivo', async () => {
      simularApiDocumentos(fetchMock, {
        detalle: aprobado({ estado: 'GENERADO', generadoAt: '2026-11-24T20:00:00.000Z' }),
        descarga: json(409, { message: 'El PDF todavía no está generado' }),
      });
      montar();
      fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('El PDF todavía no está generado');
      expect(guardar).not.toHaveBeenCalled();
    });

    it('ERROR muestra el motivo y permite reintentar con Generar PDF', async () => {
      simularApiDocumentos(fetchMock, { detalle: aprobado({ estado: 'ERROR', error: 'No se pudo guardar en el almacén' }) });
      montar();
      const pdf = (await screen.findByRole('heading', { name: 'PDF del informe' })).closest('section') as HTMLElement;
      expect(within(pdf).getByText('Con error')).toBeInTheDocument();
      expect(within(pdf).getByText('No se pudo guardar en el almacén')).toBeInTheDocument();
      fireEvent.click(within(pdf).getByRole('button', { name: 'Generar PDF' }));
      await waitFor(() => expect(llamadasApi(fetchMock, 'POST', '/pdf')).toHaveLength(1));
    });

    it('un rechazo al pedir el PDF muestra el mensaje del API', async () => {
      simularApiDocumentos(fetchMock, { detalle: aprobado(), pdf: json(503, {}) });
      montar();
      fireEvent.click(await screen.findByRole('button', { name: 'Generar PDF' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo completar la operación.');
    });

    it('sin permiso de gestión no ofrece generar ni descargar', async () => {
      simularApiDocumentos(fetchMock, { detalle: aprobado({ estado: 'GENERADO' }) });
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DocumentoDetailPage id={ID_DOC} rol={'TECNICO_OPERADOR' as never} onVolver={onVolver} guardarArchivo={guardar} />
        </QueryClientProvider>,
      );
      await screen.findByText('Generado');
      expect(screen.queryByRole('button', { name: 'Descargar PDF' })).toBeNull();
    });
  });
});
