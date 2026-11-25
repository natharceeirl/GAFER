import type { EstadoDocumento } from '@gafer/contracts';

/**
 * Único punto de traducción entre el API de documentos (`/documentos`) y el modelo de vista.
 * El API devuelve `proyecto` nulo cuando el documento no tiene sede y puede devolver el tipo CERTIFICADO,
 * que aún no figura en `TipoDocumentoSchema`: por eso la vista usa su propio tipo.
 */

export type TipoDocumentoApi = 'INFORME' | 'REPORTE' | 'CERTIFICADO';
export type EstadoPdf = 'PENDIENTE' | 'GENERANDO' | 'GENERADO' | 'ERROR';

/** Elemento de `GET /documentos` (DocumentoResumenResponseDto). */
export interface DocumentoResumenApi {
  id: string;
  codigo: string;
  clienteId: string;
  cliente: string;
  proyecto: string | null;
  tipo: TipoDocumentoApi;
  numeroCorrelativo: number;
  estado: EstadoDocumento;
  fecha: string;
}

export interface TransicionApi {
  estadoAnterior: EstadoDocumento | null;
  estadoNuevo: EstadoDocumento;
  actorId: string | null;
  actorUsuario: string;
  actorRol: string;
  motivo: string | null;
  fecha: string;
}

export interface PdfApi {
  estado: EstadoPdf | null;
  generadoAt: string | null;
  error: string | null;
}

/** `GET /documentos/:id` (DocumentoDetalleResponseDto). */
export interface DocumentoDetalleApi extends DocumentoResumenApi {
  transiciones: TransicionApi[];
  pdf: PdfApi;
}

/** Fila de la bandeja y del Dashboard. */
export interface DocumentoFila {
  id: string;
  codigo: string;
  cliente: string;
  proyecto: string;
  tipo: TipoDocumentoApi;
  estado: EstadoDocumento;
  fecha: string;
}

export interface EventoHistorial {
  estadoAnterior: EstadoDocumento | null;
  estadoNuevo: EstadoDocumento;
  usuario: string;
  rol: string;
  motivo: string | null;
  fecha: string;
}

export interface DocumentoVista {
  fila: DocumentoFila;
  historial: EventoHistorial[];
  pdf: PdfApi;
}

const ROL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
  TECNICO_OPERADOR: 'Técnico Operador',
};

export function filaDeApi(d: DocumentoResumenApi): DocumentoFila {
  return {
    id: d.id,
    codigo: d.codigo,
    cliente: d.cliente,
    proyecto: d.proyecto ?? 'Sin sede',
    tipo: d.tipo,
    estado: d.estado,
    fecha: d.fecha,
  };
}

export function detalleDeApi(d: DocumentoDetalleApi): DocumentoVista {
  return {
    fila: filaDeApi(d),
    historial: d.transiciones.map((t) => ({
      estadoAnterior: t.estadoAnterior,
      estadoNuevo: t.estadoNuevo,
      usuario: t.actorUsuario,
      rol: ROL[t.actorRol] ?? t.actorRol,
      motivo: t.motivo,
      fecha: t.fecha,
    })),
    pdf: d.pdf,
  };
}

const ETIQUETA_PDF: Record<EstadoPdf, string> = {
  PENDIENTE: 'Pendiente',
  GENERANDO: 'Generando',
  GENERADO: 'Generado',
  ERROR: 'Con error',
};

export function etiquetaPdf(estado: EstadoPdf | null): string {
  return estado ? ETIQUETA_PDF[estado] : 'Sin generar';
}

/** Generar, reintentar y descargar el PDF: Administrador y Supervisor (el API lo exige igual). */
export function puedeGestionarPdf(rol: string): boolean {
  return rol === 'ADMINISTRADOR' || rol === 'SUPERVISOR';
}

/** El PDF solo se genera para documentos aprobados o ya enviados al cliente. */
export function puedeGenerarPdf(estado: EstadoDocumento): boolean {
  return estado === 'APROBADO' || estado === 'ENVIADO';
}
