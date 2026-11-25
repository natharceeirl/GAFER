import { DocumentosController } from './documentos.controller';
import { CrearDocumentoUseCase } from '../application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../application/transicionar-documento.usecase';
import { ListarDocumentosUseCase } from '../application/listar-documentos.usecase';
import { ObtenerDocumentoUseCase } from '../application/obtener-documento.usecase';
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
  let auditoria: jest.Mocked<Pick<AuditoriaService, 'registrarEvento'>>;

  beforeEach(() => {
    mockCrear = { ejecutar: jest.fn() } as any;
    mockTransicionar = { ejecutar: jest.fn() } as any;
    mockListar = { ejecutar: jest.fn() } as any;
    mockObtener = { ejecutar: jest.fn() } as any;
    auditoria = { registrarEvento: jest.fn().mockResolvedValue(null) } as any;

    controller = new DocumentosController(mockCrear, mockTransicionar, mockListar, mockObtener, auditoria as any);
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
});
