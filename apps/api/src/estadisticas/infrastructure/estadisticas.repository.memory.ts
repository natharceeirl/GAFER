import { Injectable } from '@nestjs/common';
import {
  EstadisticasRepository,
  ResumenCliente,
} from '../domain/ports/estadisticas.repository';

// TODO: reemplazar por consultas de lectura reales contra Postgres
// (vistas o proyecciones), una vez existan datos de los demás módulos.
@Injectable()
export class EstadisticasRepositoryMemory implements EstadisticasRepository {
  async obtenerResumenCliente(clienteId: string): Promise<ResumenCliente> {
    return {
      clienteId,
      serviciosEjecutados: 0,
      documentosPendientes: 0,
      estacionesConAuraRoja: 0,
    };
  }
}
