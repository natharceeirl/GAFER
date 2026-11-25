import { randomUUID } from 'crypto';
import { EstadoGeneral } from './cliente';

import { EstadoTrabajoSchema, MOTIVO_MINIMO_CARACTERES, estadoVisibleDeServicio } from '@gafer/contracts';
import type { EstadoTrabajo, EstadoVisibleTrabajo, FrecuenciaServicio, TipoServicio } from '@gafer/contracts';

export type { EstadoTrabajo, EstadoVisibleTrabajo, FrecuenciaServicio, TipoServicio };

/**
 * Transiciones del estado de trabajo (GAF-99). CONCLUIDO y CANCELADO son finales: solo salen por una
 * reapertura explícita a EJECUTADO, con motivo. Cancelar también exige motivo.
 * PENDIENTE no es un estado guardado ni una transición: se deriva (ver `getEstadoVisible`).
 */
const TRANSICIONES_ESTADO_TRABAJO: Record<EstadoTrabajo, readonly EstadoTrabajo[]> = {
  PROGRAMADO: ['EJECUTADO', 'CANCELADO'],
  EJECUTADO: ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO: ['EJECUTADO'],
  CANCELADO: ['EJECUTADO'],
};

const ESTADOS_FINALES: readonly EstadoTrabajo[] = ['CONCLUIDO', 'CANCELADO'];

/** La transición pedida no está permitida desde el estado actual. */
export class TransicionEstadoTrabajoError extends Error {}

/** Cancelar o reabrir sin un motivo suficiente. */
export class MotivoObligatorioError extends Error {}

export interface CambioEstadoTrabajoRealizado {
  anterior: EstadoTrabajo;
  nuevo: EstadoTrabajo;
  /** El servicio estaba terminado (concluido o cancelado) y vuelve a EJECUTADO. */
  reapertura: boolean;
}

export interface ServicioContratadoProps {
  id?: string;
  proyectoId: string;
  tipoServicio: TipoServicio;
  frecuencia: FrecuenciaServicio;
  areaTotalM2: number;
  areaTratarM2: number;
  insumosAutorizados?: string[];
  equiposAutorizados?: string[];
  dosisReferencial?: Record<string, string>;
  requiereCertificado?: boolean;
  vigenciaDias?: number | null;
  estado?: EstadoGeneral;
  estadoTrabajo?: EstadoTrabajo;
  /** Fecha (AAAA-MM-DD) de la próxima visita programada sin ejecutar; solo de lectura, no se guarda en el servicio. */
  fechaProgramada?: string | null;
}

export class ServicioContratado {
  public readonly id: string;
  public readonly proyectoId: string;
  public readonly tipoServicio: TipoServicio;
  public frecuencia: FrecuenciaServicio;
  public areaTotalM2: number;
  public areaTratarM2: number;
  public insumosAutorizados: string[];
  public equiposAutorizados: string[];
  public dosisReferencial: Record<string, string>;
  public requiereCertificado: boolean;
  public vigenciaDias: number | null;
  private estado: EstadoGeneral;
  private estadoTrabajo: EstadoTrabajo;
  private readonly fechaProgramada: string | null;

  constructor(props: ServicioContratadoProps) {
    const tiposValidos: TipoServicio[] = ['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM'];
    if (!tiposValidos.includes(props.tipoServicio)) {
      throw new Error(`Tipo de servicio no válido: ${props.tipoServicio}. Debe ser uno de: ${tiposValidos.join(', ')}`);
    }

    if (props.areaTotalM2 <= 0) {
      throw new Error('El área total debe ser mayor a 0 m²');
    }

    if (props.areaTratarM2 <= 0) {
      throw new Error('El área a tratar debe ser mayor a 0 m²');
    }

    if (props.areaTratarM2 > props.areaTotalM2) {
      throw new Error('El área a tratar no puede superar el área total del establecimiento');
    }

    if (props.requiereCertificado && (!props.vigenciaDias || props.vigenciaDias <= 0)) {
      throw new Error('Si el servicio requiere certificado ambiental, debe especificarse una vigencia en días mayor a 0');
    }

    this.id = props.id ?? randomUUID();
    this.proyectoId = props.proyectoId;
    this.tipoServicio = props.tipoServicio;
    this.frecuencia = props.frecuencia;
    this.areaTotalM2 = props.areaTotalM2;
    this.areaTratarM2 = props.areaTratarM2;
    this.insumosAutorizados = props.insumosAutorizados ?? [];
    this.equiposAutorizados = props.equiposAutorizados ?? [];
    this.dosisReferencial = props.dosisReferencial ?? {};
    this.requiereCertificado = props.requiereCertificado ?? false;
    this.vigenciaDias = props.vigenciaDias ?? null;
    this.estado = props.estado ?? 'ACTIVO';

    const estadoTrabajo = props.estadoTrabajo ?? 'PROGRAMADO';
    if (!EstadoTrabajoSchema.safeParse(estadoTrabajo).success) {
      throw new Error(`Estado de trabajo no válido: ${estadoTrabajo}`);
    }
    this.estadoTrabajo = estadoTrabajo;
    this.fechaProgramada = props.fechaProgramada ?? null;
  }

  actualizarDatos(props: {
    frecuencia?: FrecuenciaServicio;
    areaTotalM2?: number;
    areaTratarM2?: number;
    insumosAutorizados?: string[];
    equiposAutorizados?: string[];
    dosisReferencial?: Record<string, string>;
    requiereCertificado?: boolean;
    vigenciaDias?: number | null;
  }): void {
    const nuevaAreaTotal = props.areaTotalM2 !== undefined ? props.areaTotalM2 : this.areaTotalM2;
    const nuevaAreaTratar = props.areaTratarM2 !== undefined ? props.areaTratarM2 : this.areaTratarM2;
    const nuevoReqCert = props.requiereCertificado !== undefined ? props.requiereCertificado : this.requiereCertificado;
    const nuevaVigencia = props.vigenciaDias !== undefined ? props.vigenciaDias : this.vigenciaDias;

    if (nuevaAreaTotal <= 0) {
      throw new Error('El área total debe ser mayor a 0 m²');
    }
    if (nuevaAreaTratar <= 0) {
      throw new Error('El área a tratar debe ser mayor a 0 m²');
    }
    if (nuevaAreaTratar > nuevaAreaTotal) {
      throw new Error('El área a tratar no puede superar el área total del establecimiento');
    }
    if (nuevoReqCert && (!nuevaVigencia || nuevaVigencia <= 0)) {
      throw new Error('Si el servicio requiere certificado ambiental, debe especificarse una vigencia en días mayor a 0');
    }

    if (props.frecuencia !== undefined) this.frecuencia = props.frecuencia;
    if (props.areaTotalM2 !== undefined) this.areaTotalM2 = props.areaTotalM2;
    if (props.areaTratarM2 !== undefined) this.areaTratarM2 = props.areaTratarM2;
    if (props.insumosAutorizados !== undefined) this.insumosAutorizados = props.insumosAutorizados;
    if (props.equiposAutorizados !== undefined) this.equiposAutorizados = props.equiposAutorizados;
    if (props.dosisReferencial !== undefined) this.dosisReferencial = props.dosisReferencial;
    if (props.requiereCertificado !== undefined) this.requiereCertificado = props.requiereCertificado;
    if (props.vigenciaDias !== undefined) this.vigenciaDias = props.vigenciaDias;
  }

  desactivar(): void {
    this.estado = 'INACTIVO';
  }

  activar(): void {
    this.estado = 'ACTIVO';
  }

  getEstado(): EstadoGeneral {
    return this.estado;
  }

  getEstadoTrabajo(): EstadoTrabajo {
    return this.estadoTrabajo;
  }

  getFechaProgramada(): string | null {
    return this.fechaProgramada;
  }

  /** Estado que se muestra: PENDIENTE si está PROGRAMADO y su fecha programada es anterior a `hoy` (AAAA-MM-DD). */
  getEstadoVisible(hoy: string): EstadoVisibleTrabajo {
    return estadoVisibleDeServicio(this.estadoTrabajo, this.fechaProgramada, hoy);
  }

  /** Cambia el estado de trabajo según las transiciones permitidas; la baja lógica no se toca. */
  cambiarEstadoTrabajo(nuevo: EstadoTrabajo, motivo?: string): CambioEstadoTrabajoRealizado {
    if (this.estado !== 'ACTIVO') {
      throw new TransicionEstadoTrabajoError('No se puede cambiar el estado de trabajo de un servicio inactivo');
    }

    const anterior = this.estadoTrabajo;
    if (!TRANSICIONES_ESTADO_TRABAJO[anterior].includes(nuevo)) {
      throw new TransicionEstadoTrabajoError(`No se puede pasar el servicio de ${anterior} a ${nuevo}`);
    }

    const reapertura = ESTADOS_FINALES.includes(anterior);
    if ((nuevo === 'CANCELADO' || reapertura) && (motivo ?? '').trim().length < MOTIVO_MINIMO_CARACTERES) {
      const accion = reapertura ? 'reabrir' : 'cancelar';
      throw new MotivoObligatorioError(
        `El motivo es obligatorio para ${accion} el servicio y debe tener al menos ${MOTIVO_MINIMO_CARACTERES} caracteres`,
      );
    }

    this.estadoTrabajo = nuevo;
    return { anterior, nuevo, reapertura };
  }
}
