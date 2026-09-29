import { randomUUID } from 'crypto';
import { EstadoGeneral } from './cliente';

import type { FrecuenciaServicio, TipoServicio } from '@gafer/contracts';

export type { FrecuenciaServicio, TipoServicio };

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
}
