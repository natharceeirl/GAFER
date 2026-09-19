export type EstadoGeneral = 'ACTIVO' | 'INACTIVO';
export type PresentacionInsumo = 'LIQUIDO' | 'POLVO' | 'BLOQUE' | 'SOBRE' | 'GEL' | 'OTRO';
export type UnidadMedidaInsumo = 'ML' | 'L' | 'G' | 'KG' | 'SOBRE' | 'BLOQUE' | 'UNIDAD';

export interface InsumoProps {
  id: string;
  nombreComercial: string;
  principioActivo: string;
  presentacion: PresentacionInsumo;
  unidadMedida: UnidadMedidaInsumo;
  registroDigesa: string;
  concentracion: string;
  dosisEstandar: string;
  fichaTecnicaKey: string;
  hojaMsdsKey: string;
  resolucionKey?: string | null;
  proveedor?: string | null;
  estado?: EstadoGeneral;
}

export class Insumo {
  public readonly id: string;
  public readonly nombreComercial: string;
  public readonly principioActivo: string;
  public readonly presentacion: PresentacionInsumo;
  public readonly unidadMedida: UnidadMedidaInsumo;
  public readonly registroDigesa: string;
  public readonly concentracion: string;
  public readonly dosisEstandar: string;
  public readonly fichaTecnicaKey: string;
  public readonly hojaMsdsKey: string;
  public readonly resolucionKey: string | null;
  public readonly proveedor: string | null;
  private estado: EstadoGeneral;

  constructor(props: InsumoProps) {
    if (!props.nombreComercial || props.nombreComercial.trim().length === 0) {
      throw new Error('El nombre comercial del insumo es obligatorio');
    }

    if (!props.registroDigesa || props.registroDigesa.trim().length === 0) {
      throw new Error('El número de registro DIGESA es obligatorio para saneamiento ambiental');
    }

    this.id = props.id;
    this.nombreComercial = props.nombreComercial.trim();
    this.principioActivo = props.principioActivo.trim();
    this.presentacion = props.presentacion;
    this.unidadMedida = props.unidadMedida;
    this.registroDigesa = props.registroDigesa.trim();
    this.concentracion = props.concentracion.trim();
    this.dosisEstandar = props.dosisEstandar.trim();
    this.fichaTecnicaKey = props.fichaTecnicaKey;
    this.hojaMsdsKey = props.hojaMsdsKey;
    this.resolucionKey = props.resolucionKey ?? null;
    this.proveedor = props.proveedor ?? null;
    this.estado = props.estado ?? 'ACTIVO';
  }

  // Compatibilidad hacia atrás
  get nombreProducto(): string {
    return this.nombreComercial;
  }

  get dosisReferencial(): string {
    return this.dosisEstandar;
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
