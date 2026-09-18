import { Module } from '@nestjs/common';
import { EstadisticasController } from './infrastructure/estadisticas.controller';
import { ObtenerResumenClienteUseCase } from './application/obtener-resumen-cliente.usecase';
import { ESTADISTICAS_REPOSITORY } from './domain/ports/estadisticas.repository';
import { EstadisticasRepositoryMemory } from './infrastructure/estadisticas.repository.memory';

@Module({
  controllers: [EstadisticasController],
  providers: [
    ObtenerResumenClienteUseCase,
    { provide: ESTADISTICAS_REPOSITORY, useClass: EstadisticasRepositoryMemory },
  ],
})
export class EstadisticasModule {}
