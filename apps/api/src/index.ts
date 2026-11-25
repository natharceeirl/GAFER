/**
 * Punto de entrada como librería: lo que `apps/worker` importa para
 * reutilizar dominio/aplicación sin duplicar lógica de negocio.
 * No re-exporta `main.ts` a propósito — ese archivo arranca el servidor
 * HTTP al importarse, y el worker no debe levantar ese proceso.
 */
export { DocumentosModule } from './documentos/documentos.module';
export { TransicionarDocumentoUseCase } from './documentos/application/transicionar-documento.usecase';
export { CrearDocumentoUseCase } from './documentos/application/crear-documento.usecase';
export { DatabaseModule } from './database/database.module';
export { StorageModule } from './shared/infrastructure/storage/storage.module';
export { GenerarPdfDocumentoUseCase } from './documentos/application/generar-pdf-documento.usecase';
export { DOCUMENTO_REPOSITORY } from './documentos/domain/ports/documento.repository';
export { TRANSACCION } from './documentos/domain/ports/transaccion.port';
export * from './documentos/domain/ports/pdf.ports';
export { conexionRedis, OPCIONES_TRABAJO_PDF } from './documentos/infrastructure/adapters/cola-pdf-bullmq';
