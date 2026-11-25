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
}

export class Documento {
  private estado: EstadoDocumento;
  private transicionesPendientes: TransicionDocumento[] = [];
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
