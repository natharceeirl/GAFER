import { Documento, EstadoDocumento, EstadoPdf } from '../documento';
import { ContextoTransaccional, TipoDocumento } from './numerador-correlativo.port';

/** Fila de la cola de revisión / listado. */
export interface DocumentoResumenLectura {
  id: string;
  codigo: string;
  clienteId: string;
  /** Razón social del cliente. */
  cliente: string;
  /** Nombre de la sede/proyecto, si el documento tiene uno. */
  proyecto: string | null;
  tipo: TipoDocumento;
  numeroCorrelativo: number;
  estado: EstadoDocumento;
  /** AAAA-MM-DD */
  fecha: string;
}

export interface TransicionLectura {
  estadoAnterior: EstadoDocumento | null;
  estadoNuevo: EstadoDocumento;
  actorId: string | null;
  actorUsuario: string;
  actorRol: string;
  motivo: string | null;
  /** ISO 8601 */
  fecha: string;
}

export interface PdfLectura {
  estado: EstadoPdf | null;
  /** ISO 8601 */
  generadoAt: string | null;
  error: string | null;
}

export interface DocumentoDetalleLectura extends DocumentoResumenLectura {
  transiciones: TransicionLectura[];
  pdf: PdfLectura;
}

export interface FiltroDocumentos {
  estado?: EstadoDocumento;
  tipo?: TipoDocumento;
  clienteId?: string;
}

export interface DocumentoRepository {
  /** Inserta o actualiza el documento y persiste sus transiciones pendientes. */
  guardar(documento: Documento, contexto?: ContextoTransaccional): Promise<void>;
  /** Con contexto transaccional bloquea la fila hasta cerrar la transacción. */
  buscarPorId(id: string, contexto?: ContextoTransaccional): Promise<Documento | null>;
  listar(filtro: FiltroDocumentos): Promise<DocumentoResumenLectura[]>;
  obtenerDetalle(id: string): Promise<DocumentoDetalleLectura | null>;
}

export const DOCUMENTO_REPOSITORY = Symbol('DOCUMENTO_REPOSITORY');
