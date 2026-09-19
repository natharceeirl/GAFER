import { EstadoGeneral } from './cliente';

export type TipoServicio = 'DSF' | 'DSS' | 'DRT' | 'LRA' | 'LTG' | 'LTS' | 'LAM';
export type FrecuenciaServicio =
  | 'DIARIA'
  | 'SEMANAL'
  | 'QUINCENAL'
  | 'MENSUAL'
  | 'BIMESTRAL'
  | 'TRIMESTRAL'
  | 'SEMESTRAL'
  | 'ANUAL'
  | 'PUNTUAL';

export interface ServicioContratadoProps {
  id: string;
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
  public readonly frecuencia: FrecuenciaServicio;
  public readonly areaTotalM2: number;
  public readonly areaTratarM2: number;
  public readonly insumosAutorizados: string[];
  public readonly equiposAutorizados: string[];
  public readonly dosisReferencial: Record<string, string>;
  public readonly requiereCertificado: boolean;
  public readonly vigenciaDias: number | null;
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

    this.id = props.id;
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
