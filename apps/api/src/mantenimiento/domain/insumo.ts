import { randomUUID } from 'crypto';

export type EstadoGeneral = 'ACTIVO' | 'INACTIVO';
export type PresentacionInsumo = 'LIQUIDO' | 'POLVO' | 'BLOQUE' | 'SOBRE' | 'GEL' | 'OTRO';
export type UnidadMedidaInsumo = 'ML' | 'L' | 'G' | 'KG' | 'SOBRE' | 'BLOQUE' | 'UNIDAD';

export interface InsumoProps {
  id?: string;
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
  public nombreComercial: string;
  public principioActivo: string;
  public presentacion: PresentacionInsumo;
  public unidadMedida: UnidadMedidaInsumo;
  public registroDigesa: string;
  public concentracion: string;
  public dosisEstandar: string;
  public fichaTecnicaKey: string;
  public hojaMsdsKey: string;
  public resolucionKey: string | null;
  public proveedor: string | null;
  private estado: EstadoGeneral;

  constructor(props: InsumoProps) {
    if (!props.nombreComercial || props.nombreComercial.trim().length === 0) {
      throw new Error('El nombre comercial del insumo es obligatorio');
    }

    if (!props.registroDigesa || props.registroDigesa.trim().length === 0) {
      throw new Error('El número de registro DIGESA es obligatorio para saneamiento ambiental');
    }

    this.id = props.id ?? randomUUID();
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

  actualizar(props: Partial<Omit<InsumoProps, 'id' | 'estado'>>): void {
    if (props.nombreComercial !== undefined) {
      if (!props.nombreComercial.trim()) {
        throw new Error('El nombre comercial del insumo es obligatorio');
      }
      this.nombreComercial = props.nombreComercial.trim();
    }
    if (props.principioActivo !== undefined) {
      this.principioActivo = props.principioActivo.trim();
    }
    if (props.presentacion !== undefined) {
      this.presentacion = props.presentacion;
    }
    if (props.unidadMedida !== undefined) {
      this.unidadMedida = props.unidadMedida;
    }
    if (props.registroDigesa !== undefined) {
      if (!props.registroDigesa.trim()) {
        throw new Error('El número de registro DIGESA es obligatorio para saneamiento ambiental');
      }
      this.registroDigesa = props.registroDigesa.trim();
    }
    if (props.concentracion !== undefined) {
      this.concentracion = props.concentracion.trim();
    }
    if (props.dosisEstandar !== undefined) {
      this.dosisEstandar = props.dosisEstandar.trim();
    }
    if (props.fichaTecnicaKey !== undefined) {
      this.fichaTecnicaKey = props.fichaTecnicaKey;
    }
    if (props.hojaMsdsKey !== undefined) {
      this.hojaMsdsKey = props.hojaMsdsKey;
    }
    if (props.resolucionKey !== undefined) {
      this.resolucionKey = props.resolucionKey;
    }
    if (props.proveedor !== undefined) {
      this.proveedor = props.proveedor;
    }
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
