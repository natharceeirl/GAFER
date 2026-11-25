import { ContextoTransaccional } from './numerador-correlativo.port';

/** Consulta mínima de Mantenimiento que necesita el documento para armar su código. */
export interface ClienteCodigoPort {
  /** Código corto del cliente (p. ej. KALLPA) o `null` si el cliente no existe. */
  buscarCodigoCorto(clienteId: string, contexto?: ContextoTransaccional): Promise<string | null>;
}

export const CLIENTE_CODIGO = Symbol('CLIENTE_CODIGO');
