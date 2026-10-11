import { BadRequestException } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { CrearDocumentoUseCase } from '../application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../application/transicionar-documento.usecase';
import { Documento } from '../domain/documento';

describe('DocumentosController', () => {
  let controller: DocumentosController;
  let mockCrear: jest.Mocked<CrearDocumentoUseCase>;
  let mockTransicionar: jest.Mocked<TransicionarDocumentoUseCase>;

  beforeEach(() => {
    mockCrear = {
      ejecutar: jest.fn(),
    } as any;
    mockTransicionar = {
      ejecutar: jest.fn(),
    } as any;

    controller = new DocumentosController(mockCrear, mockTransicionar);
  });

  describe('crear (POST /documentos)', () => {
    it('crea exitosamente un documento cuando el tipo es INFORME', async () => {
      const doc = new Documento('doc-1', 'cli-100', 101);
      mockCrear.ejecutar.mockResolvedValue(doc);

      const res = await controller.crear('cli-100', 'INFORME');

      expect(res).toEqual({
        id: 'doc-1',
        numeroCorrelativo: 101,
        estado: 'BORRADOR',
      });
      expect(mockCrear.ejecutar).toHaveBeenCalledWith('cli-100', 'INFORME');
    });

    it('crea exitosamente un documento cuando el tipo es REPORTE', async () => {
      const doc = new Documento('doc-2', 'cli-200', 102);
      mockCrear.ejecutar.mockResolvedValue(doc);

      const res = await controller.crear('cli-200', 'REPORTE');

      expect(res).toEqual({
        id: 'doc-2',
        numeroCorrelativo: 102,
        estado: 'BORRADOR',
      });
      expect(mockCrear.ejecutar).toHaveBeenCalledWith('cli-200', 'REPORTE');
    });

    it('rechaza con 400 Bad Request si tipo no es enviado (undefined)', async () => {
      await expect(
        controller.crear('cli-100', undefined as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.crear('cli-100', undefined as any),
      ).rejects.toThrow('El campo tipo es obligatorio y debe ser INFORME o REPORTE');
      expect(mockCrear.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza con 400 Bad Request si tipo es nulo', async () => {
      await expect(
        controller.crear('cli-100', null as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.crear('cli-100', null as any),
      ).rejects.toThrow('El campo tipo es obligatorio y debe ser INFORME o REPORTE');
      expect(mockCrear.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza con 400 Bad Request si tipo es un valor no soportado', async () => {
      await expect(
        controller.crear('cli-100', 'valor-que-no-existe'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.crear('cli-100', 'valor-que-no-existe'),
      ).rejects.toThrow('El campo tipo es obligatorio y debe ser INFORME o REPORTE');
      expect(mockCrear.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza con 400 Bad Request si clienteId está ausente o vacío', async () => {
      await expect(
        controller.crear('', 'INFORME'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.crear('', 'INFORME'),
      ).rejects.toThrow('El campo clienteId es obligatorio');

      await expect(
        controller.crear('   ', 'INFORME'),
      ).rejects.toThrow('El campo clienteId es obligatorio');

      await expect(
        controller.crear(undefined as any, 'INFORME'),
      ).rejects.toThrow('El campo clienteId es obligatorio');

      expect(mockCrear.ejecutar).not.toHaveBeenCalled();
    });
  });

  describe('transicionar (POST /documentos/:id/transicion)', () => {
    it('transiciona exitosamente a un estado válido', async () => {
      const doc = new Documento('doc-1', 'cli-100', 101);
      doc.transicionarA('CERRADO');
      mockTransicionar.ejecutar.mockResolvedValue(doc);

      const res = await controller.transicionar('doc-1', 'CERRADO');

      expect(res).toEqual({
        id: 'doc-1',
        estado: 'CERRADO',
      });
      expect(mockTransicionar.ejecutar).toHaveBeenCalledWith('doc-1', 'CERRADO');
    });

    it('rechaza con 400 Bad Request si el estado es desconocido', async () => {
      await expect(
        controller.transicionar('doc-1', 'ESTADO_INEXISTENTE'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.transicionar('doc-1', 'ESTADO_INEXISTENTE'),
      ).rejects.toThrow('Estado desconocido: ESTADO_INEXISTENTE');
      expect(mockTransicionar.ejecutar).not.toHaveBeenCalled();
    });
  });
});
