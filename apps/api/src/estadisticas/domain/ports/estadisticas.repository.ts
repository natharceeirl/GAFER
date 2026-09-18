export interface ResumenCliente {
  clienteId: string;
  serviciosEjecutados: number;
  documentosPendientes: number;
  estacionesConAuraRoja: number;
}

export interface EstadisticasRepository {
  obtenerResumenCliente(clienteId: string): Promise<ResumenCliente>;
}

export const ESTADISTICAS_REPOSITORY = Symbol('ESTADISTICAS_REPOSITORY');
