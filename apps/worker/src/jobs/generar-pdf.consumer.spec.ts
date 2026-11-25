import { Test } from '@nestjs/testing';
import { GenerarPdfDocumentoUseCase, PDF_RENDERER } from '@gafer/api';
import { WorkerModule } from '../worker.module';
import { PdfkitInformeRenderer } from '../pdf/pdfkit-informe.renderer';
import { GenerarPdfConsumer } from './generar-pdf.consumer';

describe('GenerarPdfConsumer', () => {
  it('delega cada trabajo en el caso de uso de apps/api (no lo duplica)', async () => {
    const generar = { ejecutar: jest.fn().mockResolvedValue(undefined) };
    const consumer = new GenerarPdfConsumer(generar as unknown as GenerarPdfDocumentoUseCase);
    await consumer.procesar({ documentoId: 'doc-1' });
    expect(generar.ejecutar).toHaveBeenCalledWith('doc-1');
  });

  it('un fallo del caso de uso se propaga para que la cola reintente (no se traga)', async () => {
    const generar = { ejecutar: jest.fn().mockRejectedValue(new Error('MinIO caído')) };
    const consumer = new GenerarPdfConsumer(generar as unknown as GenerarPdfDocumentoUseCase);
    await expect(consumer.procesar({ documentoId: 'doc-1' })).rejects.toThrow('MinIO caído');
  });

  it('el módulo del worker arma el caso de uso con el motor pdfkit detrás del puerto', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    expect(moduleRef.get(GenerarPdfConsumer)).toBeInstanceOf(GenerarPdfConsumer);
    expect(moduleRef.get(GenerarPdfDocumentoUseCase)).toBeInstanceOf(GenerarPdfDocumentoUseCase);
    expect(moduleRef.get(PDF_RENDERER)).toBeInstanceOf(PdfkitInformeRenderer);
    await moduleRef.close();
  });
});
