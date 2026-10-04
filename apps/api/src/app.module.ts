import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './shared/infrastructure/storage/storage.module';
import { AuditoriaModule } from './shared/auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/infrastructure/guards/auth.guard';
import { RolesGuard } from './auth/infrastructure/guards/roles.guard';
import { OperacionesModule } from './operaciones/operaciones.module';
import { DocumentosModule } from './documentos/documentos.module';
import { MapaMurinoModule } from './mapa-murino/mapa-murino.module';
import { ClienteExpedienteModule } from './cliente-expediente/cliente-expediente.module';
import { MantenimientoModule } from './mantenimiento/mantenimiento.module';
import { EstadisticasModule } from './estadisticas/estadisticas.module';
import { InventarioModule } from './inventario/inventario.module';
import { PROVEEDOR_VALIDACION_ZOD } from './shared/infrastructure/pipes/validacion-zod.pipe';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AuditoriaModule,
    AuthModule,
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
  providers: [
    PROVEEDOR_VALIDACION_ZOD,
    // Denegar por defecto (GAF-93): primero se valida el token y luego el rol. Solo @Public() se salta ambos;
    // una ruta sin @Roles(...) responde 403.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
