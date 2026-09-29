import { randomUUID } from 'crypto';
import { EstadoGeneral } from './cliente';

import type { CargoPersonal } from '@gafer/contracts';

export type { CargoPersonal };

export interface PersonalProps {
  id?: string;
  dni: string;
  nombres: string;
  apellidos: string;
  cargo: CargoPersonal;
  telefono: string;
  usuario?: string | null;
  estado?: EstadoGeneral;
}

export class Personal {
  public readonly id: string;
  public dni: string;
  public nombres: string;
  public apellidos: string;
  public cargo: CargoPersonal;
  public telefono: string;
  public usuario: string | null;
  private estado: EstadoGeneral;

  constructor(props: PersonalProps) {
    if (!/^[0-9]{8}$/.test(props.dni)) {
      throw new Error('El DNI debe contener exactamente 8 dígitos numéricos');
    }

    if (!props.nombres || props.nombres.trim().length === 0) {
      throw new Error('Los nombres son obligatorios');
    }

    if (!props.apellidos || props.apellidos.trim().length === 0) {
      throw new Error('Los apellidos son obligatorios');
    }

    const cargosValidos: CargoPersonal[] = ['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR'];
    if (!cargosValidos.includes(props.cargo)) {
      throw new Error(`Cargo no válido: ${props.cargo}. Debe ser ADMINISTRADOR, SUPERVISOR o TECNICO_OPERADOR`);
    }

    this.id = props.id ?? randomUUID();
    this.dni = props.dni;
    this.nombres = props.nombres.trim();
    this.apellidos = props.apellidos.trim();
    this.cargo = props.cargo;
    this.telefono = props.telefono.trim();
    this.usuario = props.usuario ? props.usuario.trim().toUpperCase() : null;
    this.estado = props.estado ?? 'ACTIVO';
  }

  actualizarDatos(props: {
    dni?: string;
    nombres?: string;
    apellidos?: string;
    cargo?: CargoPersonal;
    telefono?: string;
    usuario?: string | null;
  }): void {
    if (props.dni !== undefined) {
      if (!/^[0-9]{8}$/.test(props.dni)) {
        throw new Error('El DNI debe contener exactamente 8 dígitos numéricos');
      }
      this.dni = props.dni;
    }
    if (props.nombres !== undefined) {
      if (!props.nombres || props.nombres.trim().length === 0) {
        throw new Error('Los nombres son obligatorios');
      }
      this.nombres = props.nombres.trim();
    }
    if (props.apellidos !== undefined) {
      if (!props.apellidos || props.apellidos.trim().length === 0) {
        throw new Error('Los apellidos son obligatorios');
      }
      this.apellidos = props.apellidos.trim();
    }
    if (props.cargo !== undefined) {
      const cargosValidos: CargoPersonal[] = ['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR'];
      if (!cargosValidos.includes(props.cargo)) {
        throw new Error(`Cargo no válido: ${props.cargo}. Debe ser ADMINISTRADOR, SUPERVISOR o TECNICO_OPERADOR`);
      }
      this.cargo = props.cargo;
    }
    if (props.telefono !== undefined) {
      this.telefono = props.telefono.trim();
    }
    if (props.usuario !== undefined) {
      this.usuario = props.usuario ? props.usuario.trim().toUpperCase() : null;
    }
  }

  get nombreCompleto(): string {
    return `${this.nombres} ${this.apellidos}`;
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
