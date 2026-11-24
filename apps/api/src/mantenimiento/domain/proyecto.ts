import { randomUUID } from 'crypto';
import type { Moneda } from '@gafer/contracts';
import { EstadoGeneral } from './cliente';
import { validarMontoYMoneda } from './monto-moneda';

export type { Moneda };

export interface ProyectoProps {
  id?: string;
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
  montoPresupuestado?: number | null;
  moneda?: Moneda | null;
}

export class Proyecto {
  public readonly id: string;
  public readonly clienteId: string;
  public nombre: string;
  public direccionSede: string;
  public distrito: string;
  public provincia: string;
  public departamento: string;
  public contactoNombre: string;
  public contactoCargo: string;
  public contactoTelefono: string;
  public montoPresupuestado: number | null;
  public moneda: Moneda | null;
  private estado: EstadoGeneral;
  public observaciones: string | null;

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

    const montoPresupuestado = props.montoPresupuestado ?? null;
    const moneda = props.moneda ?? null;
    validarMontoYMoneda(montoPresupuestado, moneda, 'presupuesto');

    this.id = props.id ?? randomUUID();
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
    this.montoPresupuestado = montoPresupuestado;
    this.moneda = moneda;
  }

  actualizarDatos(props: {
    nombre?: string;
    direccionSede?: string;
    distrito?: string;
    provincia?: string;
    departamento?: string;
    contactoNombre?: string;
    contactoCargo?: string;
    contactoTelefono?: string;
    observaciones?: string | null;
    montoPresupuestado?: number | null;
    moneda?: Moneda | null;
  }): void {
    if (props.nombre !== undefined && !/^[A-Z0-9_]{3,50}$/.test(props.nombre)) {
      throw new Error('El nombre de la sede/proyecto debe tener entre 3 y 50 caracteres alfanuméricos en mayúsculas sin espacios (ej. PLANTA_SUR)');
    }
    if (props.direccionSede !== undefined && (!props.direccionSede || props.direccionSede.trim().length === 0)) {
      throw new Error('La dirección física de la sede es obligatoria');
    }

    const nuevoMonto =
      props.montoPresupuestado !== undefined ? props.montoPresupuestado : this.montoPresupuestado;
    const nuevaMoneda =
      props.moneda !== undefined
        ? props.moneda
        : props.montoPresupuestado === null
          ? null
          : this.moneda;
    validarMontoYMoneda(nuevoMonto, nuevaMoneda, 'presupuesto');

    if (props.nombre !== undefined) {
      this.nombre = props.nombre;
    }
    if (props.direccionSede !== undefined) {
      this.direccionSede = props.direccionSede.trim();
    }
    if (props.distrito !== undefined) {
      this.distrito = props.distrito.trim();
    }
    if (props.provincia !== undefined) {
      this.provincia = props.provincia.trim();
    }
    if (props.departamento !== undefined) {
      this.departamento = props.departamento.trim();
    }
    if (props.contactoNombre !== undefined) {
      this.contactoNombre = props.contactoNombre.trim();
    }
    if (props.contactoCargo !== undefined) {
      this.contactoCargo = props.contactoCargo.trim();
    }
    if (props.contactoTelefono !== undefined) {
      this.contactoTelefono = props.contactoTelefono.trim();
    }
    if (props.observaciones !== undefined) {
      this.observaciones = props.observaciones;
    }
    this.montoPresupuestado = nuevoMonto;
    this.moneda = nuevaMoneda;
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
