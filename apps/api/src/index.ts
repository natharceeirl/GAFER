/**
 * Punto de entrada como librería: lo que `apps/worker` importa para
 * reutilizar dominio/aplicación sin duplicar lógica de negocio.
 * No re-exporta `main.ts` a propósito — ese archivo arranca el servidor
 * HTTP al importarse, y el worker no debe levantar ese proceso.
 */
export { DocumentosModule } from './documentos/documentos.module';
export { TransicionarDocumentoUseCase } from './documentos/application/transicionar-documento.usecase';
export { CrearDocumentoUseCase } from './documentos/application/crear-documento.usecase';
