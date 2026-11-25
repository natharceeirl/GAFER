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
import { SolicitarPdfDocumentoUseCase } from './application/solicitar-pdf-documento.usecase';
import { ObtenerPdfDocumentoUseCase } from './application/obtener-pdf-documento.usecase';
import { ALMACEN_PDF, COLA_PDF, DOCUMENTO_PDF_DATOS } from './domain/ports/pdf.ports';
import { KyselyDocumentoPdfDatos } from './infrastructure/adapters/kysely-documento-pdf-datos';
import { AlmacenPdfS3 } from './infrastructure/adapters/almacen-pdf-s3';
import { ColaPdfBullmq } from './infrastructure/adapters/cola-pdf-bullmq';
import { KyselyClienteCodigo } from './infrastructure/adapters/kysely-cliente-codigo';

@Module({
  controllers: [DocumentosController],
  providers: [
    CrearDocumentoUseCase,
    TransicionarDocumentoUseCase,
    ListarDocumentosUseCase,
    ObtenerDocumentoUseCase,
    SolicitarPdfDocumentoUseCase,
    ObtenerPdfDocumentoUseCase,
    { provide: DOCUMENTO_PDF_DATOS, useClass: KyselyDocumentoPdfDatos },
    { provide: ALMACEN_PDF, useClass: AlmacenPdfS3 },
    { provide: COLA_PDF, useClass: ColaPdfBullmq },
    { provide: DOCUMENTO_REPOSITORY, useClass: KyselyDocumentoRepository },
    { provide: NUMERADOR_CORRELATIVO, useClass: KyselyNumeradorCorrelativo },
    { provide: TRANSACCION, useClass: KyselyTransaccion },
    { provide: CLIENTE_CODIGO, useClass: KyselyClienteCodigo },
  ],
  exports: [
    CrearDocumentoUseCase,
    TransicionarDocumentoUseCase,
    ListarDocumentosUseCase,
    ObtenerDocumentoUseCase,
    // El worker arma su propio caso de uso de generación con estos puertos (apps/worker).
    DOCUMENTO_REPOSITORY,
    TRANSACCION,
    DOCUMENTO_PDF_DATOS,
    ALMACEN_PDF,
  ],
})
export class DocumentosModule {}
