import { randomUUID } from 'crypto';
import { EstadoGeneral } from './cliente';

import { EstadoTrabajoSchema, MOTIVO_MINIMO_CARACTERES } from '@gafer/contracts';
import type { EstadoTrabajo, FrecuenciaServicio, TipoServicio } from '@gafer/contracts';

export type { EstadoTrabajo, FrecuenciaServicio, TipoServicio };

/**
 * Transiciones del estado de trabajo (GAF-99). COMPLETADO y CANCELADO son finales: solo salen por una
 * reapertura explícita a EN_CURSO, con motivo. Cancelar también exige motivo.
 */
const TRANSICIONES_ESTADO_TRABAJO: Record<EstadoTrabajo, readonly EstadoTrabajo[]> = {
  PENDIENTE: ['EN_CURSO', 'CANCELADO'],
  EN_CURSO: ['COMPLETADO', 'CANCELADO'],
  COMPLETADO: ['EN_CURSO'],
  CANCELADO: ['EN_CURSO'],
};

const ESTADOS_FINALES: readonly EstadoTrabajo[] = ['COMPLETADO', 'CANCELADO'];

/** La transición pedida no está permitida desde el estado actual. */
export class TransicionEstadoTrabajoError extends Error {}

/** Cancelar o reabrir sin un motivo suficiente. */
export class MotivoObligatorioError extends Error {}

export interface CambioEstadoTrabajoRealizado {
  anterior: EstadoTrabajo;
  nuevo: EstadoTrabajo;
  /** El servicio estaba terminado (completado o cancelado) y vuelve a EN_CURSO. */
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

    const estadoTrabajo = props.estadoTrabajo ?? 'PENDIENTE';
    if (!EstadoTrabajoSchema.safeParse(estadoTrabajo).success) {
      throw new Error(`Estado de trabajo no válido: ${estadoTrabajo}`);
    }
    this.estadoTrabajo = estadoTrabajo;
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
