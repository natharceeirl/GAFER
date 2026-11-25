import type { Mock } from 'vitest';
import type { DocumentoDetalleApi, DocumentoResumenApi, PdfApi } from '../model/documento-mapper';

export function json(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

export const ID_DOC = 'd1111111-1111-4111-8111-111111111111';

export function resumenApi(parcial: Partial<DocumentoResumenApi> = {}): DocumentoResumenApi {
  return {
    id: ID_DOC,
    codigo: 'INFORME-KALLPA-014-2026',
    clienteId: 'a1111111-1111-4111-8111-111111111111',
    cliente: 'Kallpa Generación S.A.',
    proyecto: 'Planta Chilca',
    tipo: 'INFORME',
    numeroCorrelativo: 14,
    estado: 'ENVIADO_A_REVISION',
    fecha: '2026-11-24',
    ...parcial,
  };
}

export function detalleApi(parcial: Partial<DocumentoDetalleApi> = {}, pdf: Partial<PdfApi> = {}): DocumentoDetalleApi {
  return {
    ...resumenApi(),
    transiciones: [
      { estadoAnterior: null, estadoNuevo: 'BORRADOR', actorId: null, actorUsuario: 'TEC.UNO', actorRol: 'TECNICO_OPERADOR', motivo: null, fecha: '2026-11-24T15:00:00.000Z' },
      { estadoAnterior: 'CERRADO', estadoNuevo: 'ENVIADO_A_REVISION', actorId: null, actorUsuario: 'TEC.UNO', actorRol: 'TECNICO_OPERADOR', motivo: 'Listo para revisión', fecha: '2026-11-24T18:30:00.000Z' },
    ],
    pdf: { estado: null, generadoAt: null, error: null, ...pdf },
    ...parcial,
  };
}

/** Simula el API de documentos sobre un `fetch` simulado, con estado mutable para las acciones. */
export function simularApiDocumentos(
  fetchMock: Mock,
  inicial: { detalle?: DocumentoDetalleApi; lista?: DocumentoResumenApi[]; transicion?: Response; pdf?: Response; descarga?: Response } = {},
) {
  const estado = { detalle: inicial.detalle ?? detalleApi(), lista: inicial.lista ?? [resumenApi()] };
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const ruta = new URL(String(url)).pathname.replace('/api', '');
    const metodo = init?.method ?? 'GET';
    if (metodo === 'POST' && ruta.endsWith('/transicion')) {
      if (inicial.transicion) return inicial.transicion;
      const { nuevoEstado } = JSON.parse(String(init?.body));
      estado.detalle = { ...estado.detalle, estado: nuevoEstado };
      estado.lista = estado.lista.map((d) => ({ ...d, estado: nuevoEstado }));
      return json(200, { id: estado.detalle.id, estado: nuevoEstado });
    }
    if (metodo === 'POST' && ruta.endsWith('/pdf')) {
      if (inicial.pdf) return inicial.pdf;
      estado.detalle = { ...estado.detalle, pdf: { estado: 'PENDIENTE', generadoAt: null, error: null } };
      return json(202, { id: estado.detalle.id, pdfEstado: 'PENDIENTE' });
    }
    if (metodo === 'GET' && ruta.endsWith('/pdf')) {
      return inicial.descarga ?? new Response('%PDF-1.4', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    }
    if (metodo === 'GET' && ruta === '/documentos') return json(200, estado.lista);
    if (metodo === 'GET' && ruta.startsWith('/documentos/')) return json(200, estado.detalle);
    return json(404, { message: 'No se encontró el registro solicitado.' });
  });
  return estado;
}

export function llamadasApi(fetchMock: Mock, metodo: string, sufijo: string) {
  return fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === metodo && new URL(String(url)).pathname.endsWith(sufijo));
}
