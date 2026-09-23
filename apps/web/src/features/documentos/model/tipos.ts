import type { EstadoDocumento, TipoDocumento } from '@gafer/contracts';

export interface DocumentoResumen {
  id: string;
  codigo: string;
  cliente: string;
  proyecto: string;
  tipo: TipoDocumento;
  estado: EstadoDocumento;
  fecha: string;
}

export interface InsumoUsado {
  producto: string;
  lote: string;
  cantidad: string;
  concentracion: string;
}

export interface PersonalInterviniente {
  nombre: string;
  cargo: string;
}

export interface DocumentoDetalle extends DocumentoResumen {
  diagnostico: string;
  trabajosRealizados: string;
  insumosUsados: InsumoUsado[];
  personal: PersonalInterviniente[];
  accionesCorrectivas: string[];
  observaciones: string;
  recomendaciones: string;
  fotos: number;
  numeroCertificado: string;
  vencimientoCertificado: string;
  firmaCliente: string;
  /** Sincronización en dos fases (C15): las fotos llegan después que los datos. */
  fotosRecibidas?: number;
  fotosSeleccionadas?: number[];
  comentarioObservacion?: string;
  /** Al aprobar (C7, C13, C14). */
  firmaDirector?: string;
  generados?: string[];
  anexos?: string[];
}

export const SIGUIENTE_ESTADO: Partial<Record<EstadoDocumento, EstadoDocumento>> = {
  ENVIADO_A_REVISION: 'APROBADO',
  OBSERVADO: 'ENVIADO_A_REVISION',
  APROBADO: 'ENVIADO',
};
