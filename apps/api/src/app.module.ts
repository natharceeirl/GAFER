import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './shared/infrastructure/storage/storage.module';
import { AuditoriaModule } from './shared/auditoria/auditoria.module';
import { OperacionesModule } from './operaciones/operaciones.module';
import { DocumentosModule } from './documentos/documentos.module';
import { MapaMurinoModule } from './mapa-murino/mapa-murino.module';
import { ClienteExpedienteModule } from './cliente-expediente/cliente-expediente.module';
import { MantenimientoModule } from './mantenimiento/mantenimiento.module';
import { EstadisticasModule } from './estadisticas/estadisticas.module';
import { InventarioModule } from './inventario/inventario.module';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AuditoriaModule,
    // Fase 1
    MantenimientoModule,
    ClienteExpedienteModule,
    OperacionesModule,
    // Fase 2
    DocumentosModule,
    // Fase 3
    MapaMurinoModule,
    // Fase 4
    EstadisticasModule,
    // Fase 5
    InventarioModule,
  ],
})
export class AppModule {}
