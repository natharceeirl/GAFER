import { DocumentosController } from './documentos.controller';
import { CrearDocumentoUseCase } from '../application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../application/transicionar-documento.usecase';
import { ListarDocumentosUseCase } from '../application/listar-documentos.usecase';
import { ObtenerDocumentoUseCase } from '../application/obtener-documento.usecase';
import { SolicitarPdfDocumentoUseCase } from '../application/solicitar-pdf-documento.usecase';
import { ObtenerPdfDocumentoUseCase, PdfIntegridadException } from '../application/obtener-pdf-documento.usecase';
import { Documento } from '../domain/documento';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import { TokenPayload } from '../../auth/domain/ports/token.service.port';

const USUARIO = { id: '11111111-1111-4111-8111-111111111111', usuario: 'SUP.UNO', cargo: 'SUPERVISOR' } as TokenPayload;
const ACTOR = { id: USUARIO.id, usuario: 'SUP.UNO', rol: 'SUPERVISOR' };
const CLIENTE = '22222222-2222-4222-8222-222222222222';

describe('DocumentosController', () => {
  let controller: DocumentosController;
  let mockCrear: jest.Mocked<CrearDocumentoUseCase>;
  let mockTransicionar: jest.Mocked<TransicionarDocumentoUseCase>;
  let mockListar: jest.Mocked<ListarDocumentosUseCase>;
  let mockObtener: jest.Mocked<ObtenerDocumentoUseCase>;
  let mockSolicitarPdf: jest.Mocked<SolicitarPdfDocumentoUseCase>;
  let mockObtenerPdf: jest.Mocked<ObtenerPdfDocumentoUseCase>;
  let auditoria: jest.Mocked<Pick<AuditoriaService, 'registrarEvento'>>;

  beforeEach(() => {
    mockCrear = { ejecutar: jest.fn() } as any;
    mockTransicionar = { ejecutar: jest.fn() } as any;
    mockListar = { ejecutar: jest.fn() } as any;
    mockObtener = { ejecutar: jest.fn() } as any;
    mockSolicitarPdf = { ejecutar: jest.fn() } as any;
    mockObtenerPdf = { ejecutar: jest.fn() } as any;
    auditoria = { registrarEvento: jest.fn().mockResolvedValue(null) } as any;

    controller = new DocumentosController(mockCrear, mockTransicionar, mockListar, mockObtener, auditoria as any, mockSolicitarPdf, mockObtenerPdf);
  });

  describe('crear (POST /documentos)', () => {
    it('crea el documento con el actor de la sesión y lo audita', async () => {
      const doc = new Documento('doc-1', CLIENTE, 101, { tipo: 'INFORME', codigo: 'INFORME-KAL-101-2026' });
      mockCrear.ejecutar.mockResolvedValue(doc);

      const res = await controller.crear({ clienteId: CLIENTE, tipo: 'INFORME' }, USUARIO);

      expect(res).toEqual({
        id: 'doc-1',
        codigo: 'INFORME-KAL-101-2026',
        tipo: 'INFORME',
        numeroCorrelativo: 101,
        estado: 'BORRADOR',
      });
      expect(mockCrear.ejecutar).toHaveBeenCalledWith(CLIENTE, 'INFORME', ACTOR, null);
      expect(auditoria.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'DOCUMENTOS', accion: 'CREAR', entidad: 'documento', entidadId: 'doc-1', actorUsuario: 'SUP.UNO' }),
      );
    });

    it('pasa la sede cuando viene en el cuerpo', async () => {
      mockCrear.ejecutar.mockResolvedValue(new Documento('doc-2', CLIENTE, 1, { tipo: 'REPORTE' }));
      const proyectoId = '33333333-3333-4333-8333-333333333333';
      await controller.crear({ clienteId: CLIENTE, tipo: 'REPORTE', proyectoId }, USUARIO);
      expect(mockCrear.ejecutar).toHaveBeenCalledWith(CLIENTE, 'REPORTE', ACTOR, proyectoId);
    });
  });

  describe('transicionar (POST /documentos/:id/transicion)', () => {
    it('transiciona con el actor y el motivo, y lo audita', async () => {
      const doc = new Documento('doc-1', CLIENTE, 101);
      doc.transicionarA('CERRADO');
      mockTransicionar.ejecutar.mockResolvedValue(doc);

      const res = await controller.transicionar('doc-1', { nuevoEstado: 'CERRADO', motivo: 'Listo' }, USUARIO);

      expect(res).toEqual({ id: 'doc-1', estado: 'CERRADO' });
      expect(mockTransicionar.ejecutar).toHaveBeenCalledWith('doc-1', 'CERRADO', ACTOR, 'Listo');
      expect(auditoria.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'DOCUMENTOS', accion: 'TRANSICION', payloadNuevo: { estado: 'CERRADO' } }),
      );
    });
  });

  describe('consultas', () => {
    it('listar entrega el filtro al caso de uso', async () => {
      mockListar.ejecutar.mockResolvedValue([]);
      await expect(controller.listar({ estado: 'ENVIADO_A_REVISION' })).resolves.toEqual([]);
      expect(mockListar.ejecutar).toHaveBeenCalledWith({ estado: 'ENVIADO_A_REVISION' });
    });

    it('obtener entrega el detalle con su historial', async () => {
      const detalle = { id: 'doc-1', transiciones: [] } as any;
      mockObtener.ejecutar.mockResolvedValue(detalle);
      await expect(controller.obtener('doc-1')).resolves.toBe(detalle);
    });
  });

  describe('PDF', () => {
    it('POST :id/pdf encola, audita y responde PENDIENTE', async () => {
      mockSolicitarPdf.ejecutar.mockResolvedValue(undefined);
      const res = await controller.generarPdf('doc-1', USUARIO);
      expect(res).toEqual({ id: 'doc-1', pdfEstado: 'PENDIENTE' });
      expect(mockSolicitarPdf.ejecutar).toHaveBeenCalledWith('doc-1');
      expect(auditoria.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'DOCUMENTOS', accion: 'GENERAR_PDF', entidadId: 'doc-1', actorUsuario: 'SUP.UNO' }),
      );
    });

    it('POST :id/pdf no audita si no se pudo encolar', async () => {
      mockSolicitarPdf.ejecutar.mockRejectedValue(new Error('cola caída'));
      await expect(controller.generarPdf('doc-1', USUARIO)).rejects.toThrow('cola caída');
      expect(auditoria.registrarEvento).not.toHaveBeenCalled();
    });

    it('GET :id/pdf entrega el archivo con sus cabeceras', async () => {
      mockObtenerPdf.ejecutar.mockResolvedValue({ contenido: Buffer.from('%PDF-x'), nombreArchivo: 'INFORME-KAL-001-2026.pdf' });
      const end = jest.fn();
      const set = jest.fn().mockReturnValue({ end });
      const res = { status: jest.fn().mockReturnValue({ set }) } as any;
      await controller.descargarPdf('doc-1', res, USUARIO);
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="INFORME-KAL-001-2026.pdf"', 'Content-Length': '6' }),
      );
      expect(end).toHaveBeenCalledWith(Buffer.from('%PDF-x'));
    });

    it('GET :id/pdf audita y propaga el 500 cuando el archivo no coincide con su huella (GAF-56)', async () => {
      mockObtenerPdf.ejecutar.mockRejectedValue(new PdfIntegridadException('doc-1', 'no coincide con su huella SHA-256'));
      const res = { status: jest.fn() } as any;
      await expect(controller.descargarPdf('doc-1', res, USUARIO)).rejects.toThrow('no coincide con su huella SHA-256');
      expect(res.status).not.toHaveBeenCalled();
      expect(auditoria.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'DOCUMENTOS', accion: 'PDF_INTEGRIDAD_FALLIDA', entidadId: 'doc-1', actorUsuario: 'SUP.UNO' }),
      );
    });

    it('GET :id/pdf no audita otros errores (p. ej. 409 todavía no generado)', async () => {
      mockObtenerPdf.ejecutar.mockRejectedValue(new Error('todavía no está generado'));
      await expect(controller.descargarPdf('doc-1', { status: jest.fn() } as any, USUARIO)).rejects.toThrow('todavía');
      expect(auditoria.registrarEvento).not.toHaveBeenCalled();
    });
  });
});
