import { Module } from '@nestjs/common';
import { OperacionesController } from './infrastructure/operaciones.controller';
import { RegistrarInspeccionUseCase } from './application/registrar-inspeccion.usecase';
import { CerrarInspeccionUseCase } from './application/cerrar-inspeccion.usecase';
import { ObtenerInspeccionUseCase } from './application/obtener-inspeccion.usecase';
import { INSPECCION_REPOSITORY } from './domain/ports/inspeccion.repository';
import { KyselyInspeccionRepository } from './infrastructure/adapters/kysely-inspeccion.repository';
import { MantenimientoModule } from '../mantenimiento/mantenimiento.module';

@Module({
  imports: [MantenimientoModule],
  controllers: [OperacionesController],
  providers: [
    RegistrarInspeccionUseCase,
    CerrarInspeccionUseCase,
    ObtenerInspeccionUseCase,
    { provide: INSPECCION_REPOSITORY, useClass: KyselyInspeccionRepository },
  ],
  exports: [
    RegistrarInspeccionUseCase,
    CerrarInspeccionUseCase,
    ObtenerInspeccionUseCase,
    INSPECCION_REPOSITORY,
  ],
})
export class OperacionesModule {}
