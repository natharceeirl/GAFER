import type { TipoDocumento } from './ports/numerador-correlativo.port';

export type EstadoDocumento =
  | 'BORRADOR'
  | 'CERRADO'
  | 'ENVIADO_A_REVISION'
  | 'OBSERVADO'
  | 'APROBADO'
  | 'ENVIADO';

const TRANSICIONES_PERMITIDAS: Record<EstadoDocumento, EstadoDocumento[]> = {
  BORRADOR: ['CERRADO'],
  CERRADO: ['ENVIADO_A_REVISION'],
  ENVIADO_A_REVISION: ['OBSERVADO', 'APROBADO'],
  OBSERVADO: ['ENVIADO_A_REVISION'],
  APROBADO: ['ENVIADO'],
  ENVIADO: [],
};

/** Quién ejecuta una acción sobre el documento (sale del token de la sesión). */
export interface ActorDocumento {
  id: string | null;
  usuario: string;
  rol: string;
}

export const ACTOR_SISTEMA: ActorDocumento = { id: null, usuario: 'SISTEMA', rol: 'SISTEMA' };

/** Estado de la generación asíncrona del PDF (GAF-54). `null` mientras nadie lo ha pedido. */
export type EstadoPdf = 'PENDIENTE' | 'GENERANDO' | 'GENERADO' | 'ERROR';

export interface PdfDocumento {
  estado: EstadoPdf | null;
  /** Clave del objeto en el almacenamiento de archivos. */
  storageKey: string | null;
  generadoAt: Date | null;
  /** Motivo del último fallo; visible hasta que un reintento termine bien. */
  error: string | null;
  intentos: number;
}

/** Clave determinista: regenerar el PDF sobrescribe el mismo objeto, nunca deja copias huérfanas. */
export function clavePdfDocumento(documentoId: string, codigo: string): string {
  return `documentos/${documentoId}/${codigo}.pdf`;
}

export interface TransicionDocumento {
  estadoAnterior: EstadoDocumento | null;
  estadoNuevo: EstadoDocumento;
  actor: ActorDocumento;
  motivo: string | null;
  fecha: Date;
}

export interface DocumentoProps {
  tipo?: TipoDocumento;
  codigo?: string;
  estado?: EstadoDocumento;
  proyectoId?: string | null;
  fecha?: Date;
  creadoPor?: ActorDocumento | null;
  pdf?: Partial<PdfDocumento>;
}

export class Documento {
  private estado: EstadoDocumento;
  private transicionesPendientes: TransicionDocumento[] = [];
  private pdf: PdfDocumento;
  readonly tipo: TipoDocumento;
  readonly codigo: string;
  readonly proyectoId: string | null;
  readonly fecha: Date | null;
  readonly creadoPor: ActorDocumento | null;

  constructor(
    public readonly id: string,
    public readonly clienteId: string,
    public readonly numeroCorrelativo: number,
    props: DocumentoProps = {},
  ) {
    this.estado = props.estado ?? 'BORRADOR';
    this.tipo = props.tipo ?? 'INFORME';
    this.codigo = props.codigo ?? '';
    this.proyectoId = props.proyectoId ?? null;
    this.fecha = props.fecha ?? null;
    this.creadoPor = props.creadoPor ?? null;
    this.pdf = { estado: null, storageKey: null, generadoAt: null, error: null, intentos: 0, ...props.pdf };
  }

  getPdf(): PdfDocumento {
    return { ...this.pdf };
  }

  /** Pide (o repite) el PDF. Solo un documento aprobado o enviado tiene un informe definitivo. */
  solicitarPdf(): void {
    if (this.estado !== 'APROBADO' && this.estado !== 'ENVIADO') {
      throw new Error(`Solo se puede generar el PDF de un documento aprobado (estado actual: ${this.estado})`);
    }
    this.pdf = { ...this.pdf, estado: 'PENDIENTE', error: null, intentos: 0 };
  }

  iniciarGeneracionPdf(): void {
    this.pdf = { ...this.pdf, estado: 'GENERANDO', error: null, intentos: this.pdf.intentos + 1 };
  }

  marcarPdfGenerado(storageKey: string, fecha: Date): void {
    this.exigirGenerando();
    this.pdf = { ...this.pdf, estado: 'GENERADO', storageKey, generadoAt: fecha, error: null };
  }

  marcarPdfFallido(motivo: string): void {
    this.exigirGenerando();
    this.pdf = { ...this.pdf, estado: 'ERROR', error: motivo };
  }

  private exigirGenerando(): void {
    if (this.pdf.estado !== 'GENERANDO') {
      throw new Error(`El PDF del documento ${this.id} no se está generando (estado del PDF: ${this.pdf.estado ?? 'sin pedir'})`);
    }
  }

  /** Deja constancia de la creación (sin estado anterior) en el historial. */
  registrarCreacion(actor: ActorDocumento): void {
    this.transicionesPendientes.push({
      estadoAnterior: null,
      estadoNuevo: this.estado,
      actor,
      motivo: null,
      fecha: new Date(),
    });
  }

  transicionarA(nuevoEstado: EstadoDocumento, actor: ActorDocumento = ACTOR_SISTEMA, motivo?: string | null): void {
    const permitidas = TRANSICIONES_PERMITIDAS[this.estado];
    if (!permitidas.includes(nuevoEstado)) {
      throw new Error(`No se puede pasar de ${this.estado} a ${nuevoEstado}`);
    }
    this.transicionesPendientes.push({
      estadoAnterior: this.estado,
      estadoNuevo: nuevoEstado,
      actor,
      motivo: motivo ?? null,
      fecha: new Date(),
    });
    this.estado = nuevoEstado;
  }

  getEstado(): EstadoDocumento {
    return this.estado;
  }

  /** Entrega (y olvida) las transiciones aún no persistidas: las guarda el repositorio. */
  vaciarTransicionesPendientes(): TransicionDocumento[] {
    const pendientes = this.transicionesPendientes;
    this.transicionesPendientes = [];
    return pendientes;
  }
}

/**
 * Código legible del documento. Informes y reportes: `TIPO-CLIENTE-NNN-AAAA` (el año solo es una
 * etiqueta: el contador nunca se reinicia). El certificado usa una secuencia global, sin cliente.
 */
export function construirCodigoDocumento(datos: {
  tipo: TipoDocumento;
  codigoCliente: string;
  numero: number;
  anio: number;
}): string {
  const numero = String(datos.numero).padStart(3, '0');
  if (datos.tipo === 'CERTIFICADO') return `CERTIFICADO-${numero}-${datos.anio}`;
  return `${datos.tipo}-${datos.codigoCliente}-${numero}-${datos.anio}`;
}
