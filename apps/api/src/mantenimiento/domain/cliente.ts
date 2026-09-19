import { randomUUID } from 'crypto';

export type EstadoGeneral = 'ACTIVO' | 'INACTIVO';

export interface ClienteProps {
  id?: string;
  razonSocial: string;
  ruc: string;
  codigoCorto: string;
  direccionFiscal: string;
  giroNegocio: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  contactoCorreo: string;
  estado?: EstadoGeneral;
  camposExtra?: Record<string, unknown>;
}

export class Cliente {
  public readonly id: string;
  public razonSocial: string;
  public readonly ruc: string;
  public readonly codigoCorto: string;
  public direccionFiscal: string;
  public giroNegocio: string;
  public contactoNombre: string;
  public contactoCargo: string;
  public contactoTelefono: string;
  public contactoCorreo: string;
  private estado: EstadoGeneral;
  public camposExtra: Record<string, unknown>;

  constructor(props: ClienteProps) {
    if (!/^[0-9]{11}$/.test(props.ruc)) {
      throw new Error('El RUC debe tener exactamente 11 dígitos numéricos');
    }

    if (!/^[A-Z0-9_]{3,10}$/.test(props.codigoCorto)) {
      throw new Error('El código corto debe tener entre 3 y 10 caracteres alfanuméricos en mayúsculas (ej. KALLPA, SAMAY_1)');
    }

    if (!props.razonSocial || props.razonSocial.trim().length === 0) {
      throw new Error('La razón social es obligatoria');
    }

    if (!props.contactoCorreo || !props.contactoCorreo.includes('@')) {
      throw new Error('El correo de contacto debe ser válido');
    }

    this.id = props.id ?? randomUUID();
    this.razonSocial = props.razonSocial.trim();
    this.ruc = props.ruc;
    this.codigoCorto = props.codigoCorto;
    this.direccionFiscal = props.direccionFiscal.trim();
    this.giroNegocio = props.giroNegocio.trim();
    this.contactoNombre = props.contactoNombre.trim();
    this.contactoCargo = props.contactoCargo.trim();
    this.contactoTelefono = props.contactoTelefono.trim();
    this.contactoCorreo = props.contactoCorreo.trim().toLowerCase();
    this.estado = props.estado ?? 'ACTIVO';
    this.camposExtra = props.camposExtra ?? {};
  }

  desactivar(): void {
    this.estado = 'INACTIVO';
  }

  activar(): void {
    this.estado = 'ACTIVO';
  }

  actualizarDatos(props: {
    razonSocial?: string;
    direccionFiscal?: string;
    giroNegocio?: string;
    contactoNombre?: string;
    contactoCargo?: string;
    contactoTelefono?: string;
    contactoCorreo?: string;
    camposExtra?: Record<string, unknown>;
  }): void {
    if (props.razonSocial !== undefined) {
      if (!props.razonSocial.trim()) {
        throw new Error('La razón social es obligatoria');
      }
      this.razonSocial = props.razonSocial.trim();
    }
    if (props.direccionFiscal !== undefined) {
      if (!props.direccionFiscal.trim()) {
        throw new Error('La dirección fiscal es obligatoria');
      }
      this.direccionFiscal = props.direccionFiscal.trim();
    }
    if (props.giroNegocio !== undefined) {
      this.giroNegocio = props.giroNegocio.trim();
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
    if (props.contactoCorreo !== undefined) {
      if (!props.contactoCorreo.includes('@')) {
        throw new Error('El correo de contacto debe ser válido');
      }
      this.contactoCorreo = props.contactoCorreo.trim().toLowerCase();
    }
    if (props.camposExtra !== undefined) {
      this.camposExtra = { ...this.camposExtra, ...props.camposExtra };
    }
  }

  getEstado(): EstadoGeneral {
    return this.estado;
  }
}
