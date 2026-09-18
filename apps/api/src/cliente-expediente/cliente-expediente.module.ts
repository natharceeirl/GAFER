import { Module } from '@nestjs/common';
import { ClienteExpedienteController } from './infrastructure/cliente-expediente.controller';
import { RegistrarClienteUseCase } from './application/registrar-cliente.usecase';
import { CLIENTE_REPOSITORY } from './domain/ports/cliente.repository';
import { ClienteRepositoryMemory } from './infrastructure/cliente.repository.memory';

@Module({
  controllers: [ClienteExpedienteController],
  providers: [
    RegistrarClienteUseCase,
    { provide: CLIENTE_REPOSITORY, useClass: ClienteRepositoryMemory },
  ],
  exports: [RegistrarClienteUseCase, CLIENTE_REPOSITORY],
})
export class ClienteExpedienteModule {}
