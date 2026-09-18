import { Injectable } from '@nestjs/common';
import {
  NumeradorCorrelativoPort,
  TipoDocumento,
} from '../domain/ports/numerador-correlativo.port';

/**
 * Placeholder de scaffolding: incrementa un contador en memoria por
 * clave (cliente + tipo). NO es atómico entre procesos ni sobrevive un
 * reinicio — ver el comentario del puerto. Reemplazar por una secuencia
 * de Postgres (o `SELECT ... FOR UPDATE`) antes de Fase 2.
 */
@Injectable()
export class NumeradorCorrelativoMemory implements NumeradorCorrelativoPort {
  private readonly contadores = new Map<string, number>();

  async siguienteNumero(clienteId: string, tipo: TipoDocumento): Promise<number> {
    const clave = `${clienteId}:${tipo}`;
    const actual = this.contadores.get(clave) ?? 0;
    const siguiente = actual + 1;
    this.contadores.set(clave, siguiente);
    return siguiente;
  }
}
