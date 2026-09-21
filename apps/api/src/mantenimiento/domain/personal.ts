import { randomUUID } from 'crypto';
import { EstadoGeneral } from './cliente';

export type CargoPersonal = 'SUPERVISOR' | 'TECNICO_OPERADOR';

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
  public readonly dni: string;
  public readonly nombres: string;
  public readonly apellidos: string;
  public readonly cargo: CargoPersonal;
  public readonly telefono: string;
  public readonly usuario: string | null;
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

    const cargosValidos: CargoPersonal[] = ['SUPERVISOR', 'TECNICO_OPERADOR'];
    if (!cargosValidos.includes(props.cargo)) {
      throw new Error(`Cargo no válido: ${props.cargo}. Debe ser SUPERVISOR o TECNICO_OPERADOR`);
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
