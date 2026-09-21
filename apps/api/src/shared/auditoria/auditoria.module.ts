import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditoriaInterceptor } from './auditoria.interceptor';
import { AuditoriaService } from './auditoria.service';
import { MantenimientoModule } from '../../mantenimiento/mantenimiento.module';

@Global()
@Module({
  imports: [MantenimientoModule],
  providers: [
    AuditoriaService,
    AuditoriaInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: AuditoriaInterceptor },
  ],
  exports: [AuditoriaService, AuditoriaInterceptor],
})
export class AuditoriaModule {}
