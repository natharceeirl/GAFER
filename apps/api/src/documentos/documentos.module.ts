import { Module } from '@nestjs/common';
import { DocumentosController } from './infrastructure/documentos.controller';
import { CrearDocumentoUseCase } from './application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from './application/transicionar-documento.usecase';
import { DOCUMENTO_REPOSITORY } from './domain/ports/documento.repository';
import { DocumentoRepositoryMemory } from './infrastructure/documento.repository.memory';
import { NUMERADOR_CORRELATIVO } from './domain/ports/numerador-correlativo.port';
import { NumeradorCorrelativoMemory } from './infrastructure/numerador-correlativo.memory';

@Module({
  controllers: [DocumentosController],
  providers: [
    CrearDocumentoUseCase,
    TransicionarDocumentoUseCase,
    { provide: DOCUMENTO_REPOSITORY, useClass: DocumentoRepositoryMemory },
    { provide: NUMERADOR_CORRELATIVO, useClass: NumeradorCorrelativoMemory },
  ],
  exports: [CrearDocumentoUseCase, TransicionarDocumentoUseCase],
})
export class DocumentosModule {}
