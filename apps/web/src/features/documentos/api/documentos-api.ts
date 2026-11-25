import type { EstadoDocumento } from '@gafer/contracts';
import { apiFetch, apiFetchBlob } from '../../../shared/api/http-client';
import {
  detalleDeApi,
  filaDeApi,
  type DocumentoDetalleApi,
  type DocumentoFila,
  type DocumentoResumenApi,
  type DocumentoVista,
  type TipoDocumentoApi,
} from '../model/documento-mapper';

const RUTA = '/documentos';

export interface FiltrosDocumentos {
  estado?: EstadoDocumento;
  tipo?: TipoDocumentoApi;
  clienteId?: string;
}

export async function listarDocumentos(filtros: FiltrosDocumentos = {}): Promise<DocumentoFila[]> {
  const documentos = await apiFetch<DocumentoResumenApi[]>(RUTA, { consulta: { ...filtros } });
  return documentos.map(filaDeApi);
}

export async function obtenerDocumento(id: string): Promise<DocumentoVista> {
  return detalleDeApi(await apiFetch<DocumentoDetalleApi>(`${RUTA}/${id}`));
}

export async function transicionarDocumento(id: string, nuevoEstado: EstadoDocumento, motivo?: string): Promise<void> {
  const texto = motivo?.trim();
  await apiFetch(`${RUTA}/${id}/transicion`, { metodo: 'POST', cuerpo: texto ? { nuevoEstado, motivo: texto } : { nuevoEstado } });
}

export async function solicitarPdf(id: string): Promise<void> {
  await apiFetch(`${RUTA}/${id}/pdf`, { metodo: 'POST' });
}

export function descargarPdf(id: string): Promise<Blob> {
  return apiFetchBlob(`${RUTA}/${id}/pdf`);
}
