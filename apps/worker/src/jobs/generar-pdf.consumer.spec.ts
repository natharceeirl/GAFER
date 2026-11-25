import { Test } from '@nestjs/testing';
import {
  DOCUMENTO_REPOSITORY,
  DocumentoRepositoryMemory,
  KYSELY_DATABASE,
  TRANSACCION,
  TransaccionMemory,
} from '@gafer/api';
import { WorkerModule } from '../worker.module';
import { GenerarPdfConsumer } from './generar-pdf.consumer';

describe('GenerarPdfConsumer', () => {
  it('reutiliza el caso de uso de apps/api (no lo duplica) y falla igual para un documento inexistente', async () => {
    // Prueba unitaria: sin PostgreSQL. La conexión y el repositorio se sustituyen por dobles en memoria.
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(KYSELY_DATABASE)
      .useValue({})
      .overrideProvider(DOCUMENTO_REPOSITORY)
      .useValue(new DocumentoRepositoryMemory())
      .overrideProvider(TRANSACCION)
      .useValue(new TransaccionMemory())
      .compile();
    const consumer = moduleRef.get(GenerarPdfConsumer);

    await expect(consumer.manejarDocumentoAprobado('no-existe')).rejects.toThrow(
      'Documento no-existe no encontrado',
    );

    await moduleRef.close();
  });
});
