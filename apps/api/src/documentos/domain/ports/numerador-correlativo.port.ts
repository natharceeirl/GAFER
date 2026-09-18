export type TipoDocumento = 'INFORME' | 'REPORTE';

/**
 * Debe implementarse con una operación atómica a nivel de base de datos
 * (secuencia de Postgres o lock optimista sobre el contador del cliente).
 * Calcularlo en código de aplicación (ej. MAX(numero)+1) produce
 * correlativos duplicados bajo aprobaciones concurrentes — el riesgo
 * que se marcó explícitamente al validar la arquitectura contra el
 * flujo colaborativo de Fase 1.
 */
export interface NumeradorCorrelativoPort {
  siguienteNumero(clienteId: string, tipo: TipoDocumento): Promise<number>;
}

export const NUMERADOR_CORRELATIVO = Symbol('NUMERADOR_CORRELATIVO');
