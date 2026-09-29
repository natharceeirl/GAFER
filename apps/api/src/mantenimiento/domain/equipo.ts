import { randomUUID } from 'crypto';

import type { EstadoOperativoEquipo, TipoEquipo } from '@gafer/contracts';

export type { EstadoOperativoEquipo, TipoEquipo };

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
  public codigoInterno: string;
  public nombre: string;
  public tipo: TipoEquipo;
  public marcaModelo: string | null;
  private estadoOperativo: EstadoOperativoEquipo;
  public fechaAdquisicion: string | null;
  public ultimoMantenimiento: string | null;
  public proximoMantenimiento: string | null;

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

  actualizarDatos(props: {
    codigoInterno?: string;
    nombre?: string;
    tipo?: TipoEquipo;
    marcaModelo?: string | null;
    estadoOperativo?: EstadoOperativoEquipo;
    fechaAdquisicion?: string | null;
    ultimoMantenimiento?: string | null;
    proximoMantenimiento?: string | null;
  }): void {
    if (props.codigoInterno !== undefined) {
      if (!props.codigoInterno || props.codigoInterno.trim().length === 0) {
        throw new Error('El código interno del equipo es obligatorio (ej. EQ-NEB-01)');
      }
      this.codigoInterno = props.codigoInterno.trim().toUpperCase();
    }
    if (props.nombre !== undefined) {
      if (!props.nombre || props.nombre.trim().length === 0) {
        throw new Error('El nombre del equipo es obligatorio');
      }
      this.nombre = props.nombre.trim();
    }
    if (props.tipo !== undefined) {
      this.tipo = props.tipo;
    }
    if (props.marcaModelo !== undefined) {
      this.marcaModelo = props.marcaModelo;
    }
    if (props.estadoOperativo !== undefined) {
      this.estadoOperativo = props.estadoOperativo;
    }
    if (props.fechaAdquisicion !== undefined) {
      this.fechaAdquisicion = props.fechaAdquisicion;
    }
    if (props.ultimoMantenimiento !== undefined) {
      this.ultimoMantenimiento = props.ultimoMantenimiento;
    }
    if (props.proximoMantenimiento !== undefined) {
      this.proximoMantenimiento = props.proximoMantenimiento;
    }
  }

  estaOperativo(): boolean {
    return this.estadoOperativo === 'OPERATIVO';
  }

  getEstadoOperativo(): EstadoOperativoEquipo {
    return this.estadoOperativo;
  }
}
