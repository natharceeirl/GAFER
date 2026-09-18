import { Module } from '@nestjs/common';
import { DocumentosModule } from '@gafer/api';
import { GenerarPdfConsumer } from './jobs/generar-pdf.consumer';

@Module({
  imports: [DocumentosModule],
  providers: [GenerarPdfConsumer],
})
export class WorkerModule {}
