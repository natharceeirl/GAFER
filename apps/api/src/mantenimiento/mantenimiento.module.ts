import { Module } from '@nestjs/common';
import { MantenimientoController } from './infrastructure/mantenimiento.controller';
import { RegistrarInsumoUseCase } from './application/registrar-insumo.usecase';
import { INSUMO_REPOSITORY } from './domain/ports/insumo.repository';
import { InsumoRepositoryMemory } from './infrastructure/insumo.repository.memory';

@Module({
  controllers: [MantenimientoController],
  providers: [
    RegistrarInsumoUseCase,
    { provide: INSUMO_REPOSITORY, useClass: InsumoRepositoryMemory },
  ],
  exports: [RegistrarInsumoUseCase, INSUMO_REPOSITORY],
})
export class MantenimientoModule {}
