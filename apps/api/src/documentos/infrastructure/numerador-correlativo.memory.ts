import { Injectable } from '@nestjs/common';
import {
  NumeradorCorrelativoPort,
  TipoDocumento,
} from '../domain/ports/numerador-correlativo.port';

/**
 * Solo para pruebas unitarias: incrementa un contador en memoria. NO es atómico entre procesos ni
 * sobrevive un reinicio; la aplicación usa `KyselyNumeradorCorrelativo` (Postgres).
 * Mismas reglas que el real: por cliente y tipo, salvo el certificado, que es una secuencia global.
 */
@Injectable()
export class NumeradorCorrelativoMemory implements NumeradorCorrelativoPort {
  private readonly contadores = new Map<string, number>();

  async siguienteNumero(clienteId: string, tipo: TipoDocumento): Promise<number> {
    const clave = tipo === 'CERTIFICADO' ? 'GLOBAL:CERTIFICADO' : `${clienteId}:${tipo}`;
    const siguiente = (this.contadores.get(clave) ?? 0) + 1;
    this.contadores.set(clave, siguiente);
    return siguiente;
  }
}
