import { Module } from '@nestjs/common';
import { StorageModule } from '../shared/infrastructure/storage/storage.module';
import { MantenimientoController } from './infrastructure/mantenimiento.controller';

// Use Cases - Creación
import { RegistrarClienteUseCase } from './application/registrar-cliente.usecase';
import { RegistrarProyectoUseCase } from './application/registrar-proyecto.usecase';
import { RegistrarServicioContratadoUseCase } from './application/registrar-servicio-contratado.usecase';
import { RegistrarInsumoUseCase } from './application/registrar-insumo.usecase';
import { RegistrarEquipoUseCase } from './application/registrar-equipo.usecase';
import { RegistrarPersonalUseCase } from './application/registrar-personal.usecase';

// Use Cases - Ciclo de Vida y Actualización
import { ActualizarClienteUseCase } from './application/actualizar-cliente.usecase';
import { DesactivarClienteUseCase } from './application/desactivar-cliente.usecase';
import { ActivarClienteUseCase } from './application/activar-cliente.usecase';
import { ActualizarInsumoUseCase } from './application/actualizar-insumo.usecase';
import { DesactivarInsumoUseCase } from './application/desactivar-insumo.usecase';
import { ActualizarEstadoEquipoUseCase } from './application/actualizar-estado-equipo.usecase';
import { DesactivarPersonalUseCase } from './application/desactivar-personal.usecase';

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
  imports: [StorageModule],
  controllers: [MantenimientoController],
  providers: [
    // Casos de Uso
    RegistrarClienteUseCase,
    ActualizarClienteUseCase,
    DesactivarClienteUseCase,
    ActivarClienteUseCase,
    RegistrarProyectoUseCase,
    RegistrarServicioContratadoUseCase,
    RegistrarInsumoUseCase,
    ActualizarInsumoUseCase,
    DesactivarInsumoUseCase,
    RegistrarEquipoUseCase,
    ActualizarEstadoEquipoUseCase,
    RegistrarPersonalUseCase,
    DesactivarPersonalUseCase,

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
    ActualizarClienteUseCase,
    DesactivarClienteUseCase,
    ActivarClienteUseCase,
    RegistrarProyectoUseCase,
    RegistrarServicioContratadoUseCase,
    RegistrarInsumoUseCase,
    ActualizarInsumoUseCase,
    DesactivarInsumoUseCase,
    RegistrarEquipoUseCase,
    ActualizarEstadoEquipoUseCase,
    RegistrarPersonalUseCase,
    DesactivarPersonalUseCase,
    CLIENTE_REPOSITORY,
    PROYECTO_REPOSITORY,
    SERVICIO_CONTRATADO_REPOSITORY,
    INSUMO_REPOSITORY,
    EQUIPO_REPOSITORY,
    PERSONAL_REPOSITORY,
  ],
})
export class MantenimientoModule {}
