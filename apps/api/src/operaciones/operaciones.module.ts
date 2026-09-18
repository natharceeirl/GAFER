import { Module } from '@nestjs/common';
import { OperacionesController } from './infrastructure/operaciones.controller';
import { RegistrarInspeccionUseCase } from './application/registrar-inspeccion.usecase';
import { CerrarInspeccionUseCase } from './application/cerrar-inspeccion.usecase';
import { INSPECCION_REPOSITORY } from './domain/ports/inspeccion.repository';
import { InspeccionRepositoryMemory } from './infrastructure/inspeccion.repository.memory';

@Module({
  controllers: [OperacionesController],
  providers: [
    RegistrarInspeccionUseCase,
    CerrarInspeccionUseCase,
    { provide: INSPECCION_REPOSITORY, useClass: InspeccionRepositoryMemory },
  ],
  exports: [RegistrarInspeccionUseCase, CerrarInspeccionUseCase],
})
export class OperacionesModule {}
