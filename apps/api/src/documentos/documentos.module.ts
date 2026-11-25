import { Module } from '@nestjs/common';
import { DocumentosController } from './infrastructure/documentos.controller';
import { CrearDocumentoUseCase } from './application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from './application/transicionar-documento.usecase';
import { ListarDocumentosUseCase } from './application/listar-documentos.usecase';
import { ObtenerDocumentoUseCase } from './application/obtener-documento.usecase';
import { DOCUMENTO_REPOSITORY } from './domain/ports/documento.repository';
import { NUMERADOR_CORRELATIVO } from './domain/ports/numerador-correlativo.port';
import { TRANSACCION } from './domain/ports/transaccion.port';
import { CLIENTE_CODIGO } from './domain/ports/cliente-codigo.port';
import { KyselyDocumentoRepository } from './infrastructure/adapters/kysely-documento.repository';
import { KyselyNumeradorCorrelativo } from './infrastructure/adapters/kysely-numerador-correlativo';
import { KyselyTransaccion } from './infrastructure/adapters/kysely-transaccion';
import { KyselyClienteCodigo } from './infrastructure/adapters/kysely-cliente-codigo';

@Module({
  controllers: [DocumentosController],
  providers: [
    CrearDocumentoUseCase,
    TransicionarDocumentoUseCase,
    ListarDocumentosUseCase,
    ObtenerDocumentoUseCase,
    { provide: DOCUMENTO_REPOSITORY, useClass: KyselyDocumentoRepository },
    { provide: NUMERADOR_CORRELATIVO, useClass: KyselyNumeradorCorrelativo },
    { provide: TRANSACCION, useClass: KyselyTransaccion },
    { provide: CLIENTE_CODIGO, useClass: KyselyClienteCodigo },
  ],
  exports: [CrearDocumentoUseCase, TransicionarDocumentoUseCase, ListarDocumentosUseCase, ObtenerDocumentoUseCase],
})
export class DocumentosModule {}
