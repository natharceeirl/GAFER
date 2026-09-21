import { randomUUID } from 'crypto';

export type TipoEquipo =
  | 'FUMIGACION'
  | 'NEBULIZACION'
  | 'ASPERSION'
  | 'LIMPIEZA'
  | 'MEDICION'
  | 'PROTECCION'
  | 'OTRO';

export type EstadoOperativoEquipo = 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO';

export interface EquipoProps {
  id?: string;
  codigoInterno: string;
  nombre: string;
  tipo: TipoEquipo;
  marcaModelo?: string | null;
  estadoOperativo?: EstadoOperativoEquipo;
  fechaAdquisicion?: string | null;
  ultimoMantenimiento?: string | null;
  proximoMantenimiento?: string | null;
}

export class Equipo {
  public readonly id: string;
  public readonly codigoInterno: string;
  public readonly nombre: string;
  public readonly tipo: TipoEquipo;
  public readonly marcaModelo: string | null;
  private estadoOperativo: EstadoOperativoEquipo;
  public readonly fechaAdquisicion: string | null;
  public readonly ultimoMantenimiento: string | null;
  public readonly proximoMantenimiento: string | null;

  constructor(props: EquipoProps) {
    if (!props.codigoInterno || props.codigoInterno.trim().length === 0) {
      throw new Error('El código interno del equipo es obligatorio (ej. EQ-NEB-01)');
    }

    if (!props.nombre || props.nombre.trim().length === 0) {
      throw new Error('El nombre del equipo es obligatorio');
    }

    this.id = props.id ?? randomUUID();
    this.codigoInterno = props.codigoInterno.trim().toUpperCase();
    this.nombre = props.nombre.trim();
    this.tipo = props.tipo;
    this.marcaModelo = props.marcaModelo ?? null;
    this.estadoOperativo = props.estadoOperativo ?? 'OPERATIVO';
    this.fechaAdquisicion = props.fechaAdquisicion ?? null;
    this.ultimoMantenimiento = props.ultimoMantenimiento ?? null;
    this.proximoMantenimiento = props.proximoMantenimiento ?? null;
  }

  cambiarEstadoOperativo(nuevoEstado: EstadoOperativoEquipo): void {
    this.estadoOperativo = nuevoEstado;
  }

  estaOperativo(): boolean {
    return this.estadoOperativo === 'OPERATIVO';
  }

  getEstadoOperativo(): EstadoOperativoEquipo {
    return this.estadoOperativo;
  }
}
