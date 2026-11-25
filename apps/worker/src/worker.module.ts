import { Module } from '@nestjs/common';
import { DatabaseModule, DocumentosModule } from '@gafer/api';
import { GenerarPdfConsumer } from './jobs/generar-pdf.consumer';

@Module({
  // DocumentosModule persiste en PostgreSQL: el worker necesita la misma conexión que la API.
  imports: [DatabaseModule, DocumentosModule],
  providers: [GenerarPdfConsumer],
})
export class WorkerModule {}
