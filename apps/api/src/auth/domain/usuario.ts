import * as crypto from 'crypto';
import { CargoPersonal } from '@gafer/contracts';

export class Usuario {
  constructor(
    public readonly id: string,
    public readonly dni: string,
    public readonly nombres: string,
    public readonly apellidos: string,
    public readonly cargo: CargoPersonal,
    public readonly telefono: string,
    public readonly usuario: string,
    public readonly passwordHash: string,
    public readonly estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO',
  ) {}

  get nombreCompleto(): string {
    return `${this.nombres} ${this.apellidos}`;
  }

  verificarPassword(clavePlana: string): boolean {
    if (!this.passwordHash || !clavePlana) return false;
    
    // Formato salt:hash
    const partes = this.passwordHash.split(':');
    if (partes.length === 2) {
      const [salt, hashOriginal] = partes;
      const hashPrueba = crypto
        .pbkdf2Sync(clavePlana, salt, 10000, 64, 'sha512')
        .toString('hex');
      return crypto.timingSafeEqual(
        Buffer.from(hashPrueba, 'hex'),
        Buffer.from(hashOriginal, 'hex'),
      );
    }

    // Fallback para hashes directos de prueba o SHA-256
    const hashDirecto = crypto.createHash('sha256').update(clavePlana).digest('hex');
    return this.passwordHash === hashDirecto || this.passwordHash === clavePlana;
  }

  puedeAccederAWeb(): boolean {
    // Spec §12 y Decisión C10 (§16): El Técnico Operador solo tiene acceso a la App Móvil
    return this.cargo === 'ADMINISTRADOR' || this.cargo === 'SUPERVISOR';
  }

  puedeAccederAMovil(): boolean {
    // Cualquier personal activo puede acceder a la app móvil
    return this.estado === 'ACTIVO';
  }

  static generarHashPassword(clavePlana: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(clavePlana, salt, 10000, 64, 'sha512')
      .toString('hex');
    return `${salt}:${hash}`;
  }
}
