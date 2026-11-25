export type TipoDocumento = 'INFORME' | 'REPORTE' | 'CERTIFICADO';

/**
 * Contexto transaccional opaco: el adapter de base de datos lo entiende, el dominio no. Permite que
 * el número y el documento se guarden en la misma transacción (si el guardado falla, el número se
 * devuelve y no queda un hueco en la secuencia).
 */
export type ContextoTransaccional = unknown;

/**
 * Reglas (cliente, 24/11): informes y reportes numeran por cliente y tipo y el contador NUNCA se
 * reinicia por año; el certificado usa una única secuencia global, jamás repetida entre clientes.
 *
 * Debe implementarse con una operación atómica a nivel de base de datos
 * (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`). Calcularlo en código de aplicación
 * (ej. MAX(numero)+1) produce correlativos duplicados bajo aprobaciones concurrentes.
 */
export interface NumeradorCorrelativoPort {
  siguienteNumero(clienteId: string, tipo: TipoDocumento, contexto?: ContextoTransaccional): Promise<number>;
}

export const NUMERADOR_CORRELATIVO = Symbol('NUMERADOR_CORRELATIVO');
