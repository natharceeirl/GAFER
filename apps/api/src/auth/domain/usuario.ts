import { CargoPersonal } from '@gafer/contracts';
import { verificarClave } from './clave-hash';

export class Usuario {
  constructor(
    public readonly id: string,
    public readonly dni: string,
    public readonly nombres: string,
    public readonly apellidos: string,
    public readonly cargo: CargoPersonal,
    public readonly telefono: string,
    public readonly usuario: string,
    public readonly claveHash: string | null,
    public readonly estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO',
  ) {}

  get nombreCompleto(): string {
    return `${this.nombres} ${this.apellidos}`;
  }

  /** Una fila sin clave guardada no puede iniciar sesión. */
  tieneClave(): boolean {
    return Boolean(this.claveHash);
  }

  async verificarPassword(clavePlana: string): Promise<boolean> {
    return verificarClave(clavePlana, this.claveHash);
  }

  puedeAccederAWeb(): boolean {
    // Spec §12 y Decisión C10 (§16): El Técnico Operador solo tiene acceso a la App Móvil
    return this.cargo === 'ADMINISTRADOR' || this.cargo === 'SUPERVISOR';
  }

  puedeAccederAMovil(): boolean {
    // Cualquier personal activo puede acceder a la app móvil
    return this.estado === 'ACTIVO';
  }
}
