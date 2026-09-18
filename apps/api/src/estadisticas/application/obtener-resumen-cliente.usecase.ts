import { Inject, Injectable } from '@nestjs/common';
import {
  ESTADISTICAS_REPOSITORY,
  EstadisticasRepository,
  ResumenCliente,
} from '../domain/ports/estadisticas.repository';

@Injectable()
export class ObtenerResumenClienteUseCase {
  constructor(
    @Inject(ESTADISTICAS_REPOSITORY) private readonly repo: EstadisticasRepository,
  ) {}

  async ejecutar(clienteId: string): Promise<ResumenCliente> {
    return this.repo.obtenerResumenCliente(clienteId);
  }
}
