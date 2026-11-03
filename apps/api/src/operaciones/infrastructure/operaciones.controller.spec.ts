import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { OperacionesController } from './operaciones.controller';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import { CerrarInspeccionUseCase } from '../application/cerrar-inspeccion.usecase';
import { ObtenerInspeccionUseCase } from '../application/obtener-inspeccion.usecase';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import { Inspeccion } from '../domain/inspeccion';
import { TokenPayload } from '../../auth/domain/ports/token.service.port';

describe('OperacionesController', () => {
  let controller: OperacionesController;
  let mockRegistrar: jest.Mocked<RegistrarInspeccionUseCase>;
  let mockCerrar: jest.Mocked<CerrarInspeccionUseCase>;
  let mockObtener: jest.Mocked<ObtenerInspeccionUseCase>;
  let mockAuditoria: jest.Mocked<AuditoriaService>;

  const usuarioTecnico: TokenPayload = {
    id: 'tec-123',
    dni: '12345678',
    usuario: 'JPEREZ',
    cargo: 'TECNICO_OPERADOR',
    nombreCompleto: 'Juan Perez',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const usuarioAdmin: TokenPayload = {
    id: 'adm-001',
    dni: '87654321',
    usuario: 'ADMIN',
    cargo: 'ADMINISTRADOR',
    nombreCompleto: 'Admin General',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    mockRegistrar = { ejecutar: jest.fn() } as any;
    mockCerrar = { execute: jest.fn() } as any;
    mockObtener = {
      ejecutarPorId: jest.fn(),
      ejecutarPorServicioId: jest.fn(),
      ejecutarPorTecnico: jest.fn(),
      ejecutarTodas: jest.fn(),
    } as any;
    mockAuditoria = {
      persistirInspeccionAuditoria: jest.fn().mockResolvedValue(undefined),
      registrarEvento: jest.fn().mockResolvedValue({} as any),
      listarPorInspeccion: jest.fn().mockResolvedValue([]),
    } as any;

    controller = new OperacionesController(
      mockRegistrar,
      mockCerrar,
      mockObtener,
      mockAuditoria,
    );
  });

  it('debe registrar una inspección en borrador', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    mockRegistrar.ejecutar.mockResolvedValue(inspeccion);

    const res = await controller.crear({ servicioId: 'srv-1' });

    expect(res.id).toBe('insp-1');
    expect(res.estado).toBe('BORRADOR');
    expect(mockRegistrar.ejecutar).toHaveBeenCalledWith('srv-1');
  });

  it('debe consultar una inspección por servicioId (usado por frontend web)', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    mockObtener.ejecutarPorServicioId.mockResolvedValue(inspeccion);

    const res = await controller.consultar('srv-1');

    expect(res).not.toBeNull();
    expect(res?.id).toBe('insp-1');
    expect(res?.servicioId).toBe('srv-1');
    expect(mockObtener.ejecutarPorServicioId).toHaveBeenCalledWith('srv-1');
  });

  it('debe retornar null al consultar con servicioId sin inspección activa', async () => {
    mockObtener.ejecutarPorServicioId.mockResolvedValue(null);

    const res = await controller.consultar('srv-inactivo');

    expect(res).toBeNull();
  });

  it('debe obtener el detalle de una inspección por ID con snapshot inmutable', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    inspeccion.cerrar({
      insumos: [
        {
          insumoId: 'ins-1',
          nombreHistorico: 'Cipermetrina',
          principioActivo: 'Cipermetrina',
          presentacion: 'L',
          unidadMedida: 'L',
          registroDigesa: 'RD-001',
          concentracion: '25%',
          dosisAplicada: '5ml',
          lote: 'L-1',
          cantidadUtilizada: 1,
          congeladoEn: '2026-09-19T00:00:00.000Z',
        },
      ],
      fechaCierre: '2026-09-19T00:00:00.000Z',
    });
    mockObtener.ejecutarPorId.mockResolvedValue(inspeccion);

    const res = await controller.obtenerPorId('insp-1', usuarioAdmin);

    expect(res.id).toBe('insp-1');
    expect(res.estado).toBe('CERRADO');
    expect(res.snapshotCatalogos.insumos).toHaveLength(1);
    expect(res.snapshotCatalogos.insumos[0].nombreHistorico).toBe('Cipermetrina');
  });

  it('debe cerrar la inspección y retornar snapshot congelado', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    inspeccion.cerrar([]);
    mockCerrar.execute.mockResolvedValue(inspeccion);

    const res = await controller.cerrar('insp-1');

    expect(res.id).toBe('insp-1');
    expect(res.estado).toBe('CERRADO');
    expect(mockCerrar.execute).toHaveBeenCalledWith({
      inspeccionId: 'insp-1',
      consumos: undefined,
      equiposIds: undefined,
      personalIds: undefined,
    });
  });

  // Tests GAF-104: Mis servicios, restricción de acceso y solicitud de corrección
  describe('GAF-104: Mis servicios y correcciones', () => {
    it('debe listar solo los servicios del técnico cuando el rol es TECNICO_OPERADOR', async () => {
      const insp = new Inspeccion({
        id: 'insp-1',
        servicioId: 'srv-1',
        codigoInspeccion: 'GAFER-2026-001',
        fechaEjecucion: '2026-11-03',
        estado: 'CERRADO',
        tecnicosParticipantes: [{ id: 'tec-123', nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorTecnico.mockResolvedValue([insp]);

      const res = await controller.listarMisServicios(usuarioTecnico);

      expect(mockObtener.ejecutarPorTecnico).toHaveBeenCalledWith('tec-123');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('insp-1');
      expect(res[0].puedeSolicitarCorreccion).toBe(true);
    });

    it('debe listar todas las inspecciones cuando el rol es ADMINISTRADOR', async () => {
      const insp1 = new Inspeccion('insp-1', 'srv-1');
      const insp2 = new Inspeccion('insp-2', 'srv-2');
      mockObtener.ejecutarTodas.mockResolvedValue([insp1, insp2]);

      const res = await controller.listarMisServicios(usuarioAdmin);

      expect(mockObtener.ejecutarTodas).toHaveBeenCalled();
      expect(res).toHaveLength(2);
    });

    it('debe denegar con ForbiddenException a un técnico que intenta consultar inspección ajena', async () => {
      const inspAjena = new Inspeccion({
        id: 'insp-ajena',
        servicioId: 'srv-9',
        codigoInspeccion: 'GAFER-2026-AJENA',
        fechaEjecucion: '2026-11-03',
        tecnicosParticipantes: [{ id: 'otro-tecnico-999', nombre: 'Carlos Ruiz' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspAjena);

      await expect(
        controller.obtenerPorId('insp-ajena', usuarioTecnico),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir consultar por ID si el técnico participó en la inspección', async () => {
      const inspPropia = new Inspeccion({
        id: 'insp-propia',
        servicioId: 'srv-1',
        codigoInspeccion: 'GAFER-2026-PROPIA',
        fechaEjecucion: '2026-11-03',
        tecnicosParticipantes: [{ id: 'tec-123', nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspPropia);

      const res = await controller.obtenerPorId('insp-propia', usuarioTecnico);
      expect(res.id).toBe('insp-propia');
    });

    it('debe rechazar solicitud de corrección si la inspección no está CERRADA', async () => {
      const inspBorrador = new Inspeccion({
        id: 'insp-borrador',
        servicioId: 'srv-1',
        codigoInspeccion: 'GAFER-2026-BORRADOR',
        fechaEjecucion: '2026-11-03',
        estado: 'BORRADOR',
        tecnicosParticipantes: [{ id: 'tec-123', nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspBorrador);

      await expect(
        controller.solicitarCorreccion(
          'insp-borrador',
          { motivo: 'Se equivocó de fecha' },
          usuarioTecnico,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar solicitud de corrección si el técnico no participó en la inspección', async () => {
      const inspCerradaAjena = new Inspeccion({
        id: 'insp-cerrada-ajena',
        servicioId: 'srv-1',
        codigoInspeccion: 'GAFER-2026-CERRADA-AJENA',
        fechaEjecucion: '2026-11-03',
        estado: 'CERRADO',
        tecnicosParticipantes: [{ id: 'otro-tecnico', nombre: 'Pedro Gomez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspCerradaAjena);

      await expect(
        controller.solicitarCorreccion(
          'insp-cerrada-ajena',
          { motivo: 'Corregir estación 12' },
          usuarioTecnico,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe procesar exitosamente la solicitud de corrección y registrar en auditoría', async () => {
      const inspCerrada = new Inspeccion({
        id: 'insp-cerrada',
        servicioId: 'srv-1',
        codigoInspeccion: 'GAFER-2026-CERRADA',
        fechaEjecucion: '2026-11-03',
        estado: 'CERRADO',
        tecnicosParticipantes: [{ id: 'tec-123', nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspCerrada);

      const res = await controller.solicitarCorreccion(
        'insp-cerrada',
        { motivo: 'Se ingresó erróneamente el número de estación 12 en vez de la 14' },
        usuarioTecnico,
      );

      expect(res.ok).toBe(true);
      expect(res.inspeccionId).toBe('insp-cerrada');
      expect(mockAuditoria.persistirInspeccionAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          inspeccionId: 'insp-cerrada',
          actorId: 'tec-123',
          accion: 'SOLICITUD_CORRECCION',
        }),
      );
      expect(mockAuditoria.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'operaciones',
          accion: 'SOLICITAR_CORRECCION',
          entidadId: 'insp-cerrada',
        }),
      );
    });
  });
});
