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
}

export const SIGUIENTE_ESTADO: Partial<Record<EstadoDocumento, EstadoDocumento>> = {
  ENVIADO_A_REVISION: 'APROBADO',
  OBSERVADO: 'ENVIADO_A_REVISION',
  APROBADO: 'ENVIADO',
};
