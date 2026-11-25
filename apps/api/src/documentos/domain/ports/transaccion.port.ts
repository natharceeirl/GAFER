import { ContextoTransaccional } from './numerador-correlativo.port';

/** Ejecuta un bloque de trabajo de forma atómica: o se guarda todo o no se guarda nada. */
export interface TransaccionPort {
  ejecutar<T>(trabajo: (contexto: ContextoTransaccional) => Promise<T>): Promise<T>;
}

export const TRANSACCION = Symbol('TRANSACCION');
