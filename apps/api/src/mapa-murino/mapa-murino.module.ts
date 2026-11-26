import { Module } from '@nestjs/common';
import { MapaMurinoController } from './infrastructure/mapa-murino.controller';
import { PlanosMapaController } from './infrastructure/planos-mapa.controller';
import { RegistrarInspeccionEstacionUseCase } from './application/registrar-inspeccion-estacion.usecase';
import { CrearPlanoUseCase } from './application/crear-plano.usecase';
import { ListarPlanosUseCase } from './application/listar-planos.usecase';
import { ListarVisitasPlanoUseCase } from './application/listar-visitas-plano.usecase';
import { ObtenerMapaVisitaUseCase } from './application/obtener-mapa-visita.usecase';
import { RegistrarVisitaMapaUseCase } from './application/registrar-visita-mapa.usecase';
import { ESTACION_REPOSITORY } from './domain/ports/estacion.repository';
import { MAPA_REPOSITORY } from './domain/ports/mapa.repository';
import { EstacionRepositoryMemory } from './infrastructure/estacion.repository.memory';
import { KyselyMapaRepository } from './infrastructure/kysely-mapa.repository';

@Module({
  controllers: [MapaMurinoController, PlanosMapaController],
  providers: [
    RegistrarInspeccionEstacionUseCase,
    CrearPlanoUseCase,
    ListarPlanosUseCase,
    ListarVisitasPlanoUseCase,
    ObtenerMapaVisitaUseCase,
    RegistrarVisitaMapaUseCase,
    { provide: ESTACION_REPOSITORY, useClass: EstacionRepositoryMemory },
    { provide: MAPA_REPOSITORY, useClass: KyselyMapaRepository },
  ],
  exports: [RegistrarInspeccionEstacionUseCase, CrearPlanoUseCase, RegistrarVisitaMapaUseCase, ObtenerMapaVisitaUseCase],
})
export class MapaMurinoModule {}
