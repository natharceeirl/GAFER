import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EstadoDocumento } from '@gafer/contracts';
import {
  descargarPdf,
  listarDocumentos,
  obtenerDocumento,
  solicitarPdf,
  transicionarDocumento,
  type FiltrosDocumentos,
} from './documentos-api';

export const documentosKeys = {
  todos: ['documentos'] as const,
  lista: (filtros: FiltrosDocumentos) => ['documentos', 'lista', filtros] as const,
  detalle: (id: string) => ['documentos', 'detalle', id] as const,
};

/** Documentos del API, del más reciente al más antiguo. */
export function useDocumentosLista(filtros: FiltrosDocumentos = {}) {
  return useQuery({ queryKey: documentosKeys.lista(filtros), queryFn: () => listarDocumentos(filtros) });
}

const INTERVALO_PDF_MS = 3000;

/**
 * Detalle con historial y estado del PDF. Mientras el PDF está pendiente o generándose consulta de nuevo
 * cada pocos segundos, porque lo genera un worker aparte.
 */
export function useDocumento(id: string | null, { intervaloPdfMs = INTERVALO_PDF_MS }: { intervaloPdfMs?: number } = {}) {
  return useQuery({
    queryKey: documentosKeys.detalle(id ?? ''),
    queryFn: () => obtenerDocumento(id as string),
    enabled: id !== null,
    refetchInterval: (consulta) => {
      const estado = consulta.state.data?.pdf.estado;
      return estado === 'PENDIENTE' || estado === 'GENERANDO' ? intervaloPdfMs : false;
    },
  });
}

export function useTransicionarDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nuevoEstado, motivo }: { id: string; nuevoEstado: EstadoDocumento; motivo?: string }) =>
      transicionarDocumento(id, nuevoEstado, motivo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentosKeys.todos }),
  });
}

export function useSolicitarPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => solicitarPdf(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentosKeys.todos }),
  });
}

export function useDescargarPdf() {
  return useMutation({ mutationFn: (id: string) => descargarPdf(id) });
}
