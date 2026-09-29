import { CargoPersonal } from '@gafer/contracts';
import { Usuario } from '../usuario';

export interface TokenPayload {
  id: string;
  dni: string;
  usuario: string;
  cargo: CargoPersonal;
  nombreCompleto: string;
  exp: number;
}

export interface TokenServicePort {
  generarToken(usuario: Usuario): string;
  verificarToken(token: string): TokenPayload;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
