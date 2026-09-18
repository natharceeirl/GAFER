import { Module } from '@nestjs/common';
import { MapaMurinoController } from './infrastructure/mapa-murino.controller';
import { RegistrarInspeccionEstacionUseCase } from './application/registrar-inspeccion-estacion.usecase';
import { ESTACION_REPOSITORY } from './domain/ports/estacion.repository';
import { EstacionRepositoryMemory } from './infrastructure/estacion.repository.memory';

@Module({
  controllers: [MapaMurinoController],
  providers: [
    RegistrarInspeccionEstacionUseCase,
    { provide: ESTACION_REPOSITORY, useClass: EstacionRepositoryMemory },
  ],
  exports: [RegistrarInspeccionEstacionUseCase],
})
export class MapaMurinoModule {}
