import { Module } from '@nestjs/common';
import { DatabaseModule, DocumentosModule, GenerarPdfDocumentoUseCase, PDF_RENDERER, StorageModule } from '@gafer/api';
import { GenerarPdfConsumer } from './jobs/generar-pdf.consumer';
import { PdfkitInformeRenderer } from './pdf/pdfkit-informe.renderer';

@Module({
  imports: [DatabaseModule, StorageModule, DocumentosModule],
  providers: [
    GenerarPdfDocumentoUseCase,
    // El motor de PDF se elige aquí: cambiar de motor es cambiar esta línea (puerto PdfRendererPort).
    { provide: PDF_RENDERER, useClass: PdfkitInformeRenderer },
    GenerarPdfConsumer,
  ],
})
export class WorkerModule {}
