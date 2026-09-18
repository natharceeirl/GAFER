import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditoriaInterceptor } from './auditoria.interceptor';

@Module({
  providers: [
    AuditoriaInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: AuditoriaInterceptor },
  ],
  exports: [AuditoriaInterceptor],
})
export class AuditoriaModule {}
