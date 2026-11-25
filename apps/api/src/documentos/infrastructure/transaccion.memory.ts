import { Injectable } from '@nestjs/common';
import { ContextoTransaccional } from '../domain/ports/numerador-correlativo.port';
import { TransaccionPort } from '../domain/ports/transaccion.port';

/** Para pruebas unitarias: no hay base de datos, así que solo ejecuta el trabajo. */
@Injectable()
export class TransaccionMemory implements TransaccionPort {
  async ejecutar<T>(trabajo: (contexto: ContextoTransaccional) => Promise<T>): Promise<T> {
    return trabajo(undefined);
  }
}
