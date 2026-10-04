import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TokenPayload, TokenServicePort } from '../domain/ports/token.service.port';
import { Usuario } from '../domain/usuario';

const SECRETO_LARGO_MINIMO = 32;

@Injectable()
export class TokenService implements TokenServicePort {
  private readonly secretKey: string;

  constructor() {
    this.secretKey = TokenService.leerSecreto();
  }

  private static leerSecreto(): string {
    const secreto = process.env.JWT_SECRET;
    if (!secreto) {
      throw new Error(
        'Falta la variable de entorno JWT_SECRET: la API no arranca sin un secreto para firmar los tokens. ' +
          'Define una cadena aleatoria de al menos 32 caracteres (ver apps/api/.env.example).',
      );
    }
    if (secreto.length < SECRETO_LARGO_MINIMO) {
      throw new Error(
        `JWT_SECRET es demasiado corto: debe tener al menos ${SECRETO_LARGO_MINIMO} caracteres.`,
      );
    }
    return secreto;
  }

  generarToken(usuario: Usuario): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const ahora = Math.floor(Date.now() / 1000);
    const exp = ahora + 8 * 3600; // 8 horas de validez

    const payload: TokenPayload = {
      id: usuario.id,
      dni: usuario.dni,
      usuario: usuario.usuario,
      cargo: usuario.cargo,
      nombreCompleto: usuario.nombreCompleto,
      exp,
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  verificarToken(token: string): TokenPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Token de autenticación ausente o inválido');
    }

    const partes = token.split('.');
    if (partes.length !== 3) {
      throw new UnauthorizedException('Estructura de token inválida');
    }

    const [headerB64, payloadB64, signature] = partes;

    const signatureEsperada = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(signatureEsperada))) {
      throw new UnauthorizedException('Firma de token inválida');
    }

    try {
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
      const payload: TokenPayload = JSON.parse(payloadJson);

      const ahora = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < ahora) {
        throw new UnauthorizedException('La sesión ha expirado');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Error al decodificar la sesión');
    }
  }
}
