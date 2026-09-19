import { Module } from '@nestjs/common';
import { MantenimientoController } from './infrastructure/mantenimiento.controller';

// Use Cases
import { RegistrarClienteUseCase } from './application/registrar-cliente.usecase';
import { RegistrarProyectoUseCase } from './application/registrar-proyecto.usecase';
import { RegistrarServicioContratadoUseCase } from './application/registrar-servicio-contratado.usecase';
import { RegistrarInsumoUseCase } from './application/registrar-insumo.usecase';
import { RegistrarEquipoUseCase } from './application/registrar-equipo.usecase';
import { RegistrarPersonalUseCase } from './application/registrar-personal.usecase';

// Ports
import { CLIENTE_REPOSITORY } from './domain/ports/cliente.repository';
import { PROYECTO_REPOSITORY } from './domain/ports/proyecto.repository';
import { SERVICIO_CONTRATADO_REPOSITORY } from './domain/ports/servicio-contratado.repository';
import { INSUMO_REPOSITORY } from './domain/ports/insumo.repository';
import { EQUIPO_REPOSITORY } from './domain/ports/equipo.repository';
import { PERSONAL_REPOSITORY } from './domain/ports/personal.repository';

// Adapters
import { KyselyClienteRepository } from './infrastructure/adapters/kysely-cliente.repository';
import { KyselyProyectoRepository } from './infrastructure/adapters/kysely-proyecto.repository';
import { KyselyServicioContratadoRepository } from './infrastructure/adapters/kysely-servicio-contratado.repository';
import { KyselyInsumoRepository } from './infrastructure/adapters/kysely-insumo.repository';
import { KyselyEquipoRepository } from './infrastructure/adapters/kysely-equipo.repository';
import { KyselyPersonalRepository } from './infrastructure/adapters/kysely-personal.repository';

@Module({
  controllers: [MantenimientoController],
  providers: [
    // Casos de Uso
    RegistrarClienteUseCase,
    RegistrarProyectoUseCase,
    RegistrarServicioContratadoUseCase,
    RegistrarInsumoUseCase,
    RegistrarEquipoUseCase,
    RegistrarPersonalUseCase,

    // Adaptadores Kysely enlazados a sus Puertos
    { provide: CLIENTE_REPOSITORY, useClass: KyselyClienteRepository },
    { provide: PROYECTO_REPOSITORY, useClass: KyselyProyectoRepository },
    {
      provide: SERVICIO_CONTRATADO_REPOSITORY,
      useClass: KyselyServicioContratadoRepository,
    },
    { provide: INSUMO_REPOSITORY, useClass: KyselyInsumoRepository },
    { provide: EQUIPO_REPOSITORY, useClass: KyselyEquipoRepository },
    { provide: PERSONAL_REPOSITORY, useClass: KyselyPersonalRepository },
  ],
  exports: [
    RegistrarClienteUseCase,
    RegistrarProyectoUseCase,
    RegistrarServicioContratadoUseCase,
    RegistrarInsumoUseCase,
    RegistrarEquipoUseCase,
    RegistrarPersonalUseCase,
    CLIENTE_REPOSITORY,
    PROYECTO_REPOSITORY,
    SERVICIO_CONTRATADO_REPOSITORY,
    INSUMO_REPOSITORY,
    EQUIPO_REPOSITORY,
    PERSONAL_REPOSITORY,
  ],
})
export class MantenimientoModule {}
