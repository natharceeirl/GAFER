import { EstadoGeneral } from './cliente';

export interface ProyectoProps {
  id: string;
  clienteId: string;
  nombre: string;
  direccionSede: string;
  distrito: string;
  provincia: string;
  departamento: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  estado?: EstadoGeneral;
  observaciones?: string | null;
}

export class Proyecto {
  public readonly id: string;
  public readonly clienteId: string;
  public readonly nombre: string;
  public readonly direccionSede: string;
  public readonly distrito: string;
  public readonly provincia: string;
  public readonly departamento: string;
  public readonly contactoNombre: string;
  public readonly contactoCargo: string;
  public readonly contactoTelefono: string;
  private estado: EstadoGeneral;
  public readonly observaciones: string | null;

  constructor(props: ProyectoProps) {
    if (!/^[A-Z0-9_]{3,50}$/.test(props.nombre)) {
      throw new Error('El nombre de la sede/proyecto debe tener entre 3 y 50 caracteres alfanuméricos en mayúsculas sin espacios (ej. PLANTA_SUR)');
    }

    if (!props.clienteId) {
      throw new Error('El proyecto debe estar vinculado a un cliente válido');
    }

    if (!props.direccionSede || props.direccionSede.trim().length === 0) {
      throw new Error('La dirección física de la sede es obligatoria');
    }

    this.id = props.id;
    this.clienteId = props.clienteId;
    this.nombre = props.nombre;
    this.direccionSede = props.direccionSede.trim();
    this.distrito = props.distrito.trim();
    this.provincia = props.provincia.trim();
    this.departamento = props.departamento.trim();
    this.contactoNombre = props.contactoNombre.trim();
    this.contactoCargo = props.contactoCargo.trim();
    this.contactoTelefono = props.contactoTelefono.trim();
    this.estado = props.estado ?? 'ACTIVO';
    this.observaciones = props.observaciones ?? null;
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
