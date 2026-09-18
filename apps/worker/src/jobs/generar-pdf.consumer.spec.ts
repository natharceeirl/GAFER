import { Test } from '@nestjs/testing';
import { WorkerModule } from '../worker.module';
import { GenerarPdfConsumer } from './generar-pdf.consumer';

describe('GenerarPdfConsumer', () => {
  it('reutiliza el caso de uso de apps/api (no lo duplica) y falla igual para un documento inexistente', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    const consumer = moduleRef.get(GenerarPdfConsumer);

    await expect(consumer.manejarDocumentoAprobado('no-existe')).rejects.toThrow(
      'Documento no-existe no encontrado',
    );

    await moduleRef.close();
  });
});
