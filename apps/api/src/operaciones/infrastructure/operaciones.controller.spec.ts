import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ResumenServicioTecnicoSchema } from '@gafer/contracts';
import { OperacionesController } from './operaciones.controller';
import { RegistrarInspeccionUseCase } from '../application/registrar-inspeccion.usecase';
import { CerrarInspeccionUseCase } from '../application/cerrar-inspeccion.usecase';
import { ObtenerInspeccionUseCase } from '../application/obtener-inspeccion.usecase';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import { Inspeccion } from '../domain/inspeccion';
import { TokenPayload } from '../../auth/domain/ports/token.service.port';

const INSP_1_UUID = '11111111-1111-4111-8111-111111111111';
const INSP_2_UUID = '11111111-1111-4111-8111-111111111112';
const SRV_1_UUID = '22222222-2222-4222-8222-222222222221';
const SRV_2_UUID = '22222222-2222-4222-8222-222222222222';
const TEC_UUID = '33333333-3333-4333-8333-333333333331';
const OTRO_TEC_UUID = '33333333-3333-4333-8333-333333333339';
const ADM_UUID = '44444444-4444-4444-8444-444444444441';

describe('OperacionesController', () => {
  let controller: OperacionesController;
  let mockRegistrar: jest.Mocked<RegistrarInspeccionUseCase>;
  let mockCerrar: jest.Mocked<CerrarInspeccionUseCase>;
  let mockObtener: jest.Mocked<ObtenerInspeccionUseCase>;
  let mockAuditoria: jest.Mocked<AuditoriaService>;

  const usuarioTecnico: TokenPayload = {
    id: TEC_UUID,
    dni: '12345678',
    usuario: 'JPEREZ',
    cargo: 'TECNICO_OPERADOR',
    nombreCompleto: 'Juan Perez',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const usuarioAdmin: TokenPayload = {
    id: ADM_UUID,
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
      resolverActorId: jest.fn(async (id?: string) => id ?? null),
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
    it('debe listar solo los servicios cerrados del técnico cumpliendo ResumenServicioTecnicoSchema e incluyendo metadatos reales', async () => {
      const inspCerrada = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-001',
        fechaEjecucion: '2026-11-03',
        horaInicio: '08:30',
        horaFin: '10:45',
        estado: 'CERRADO',
        versionSync: 2,
        tecnicosParticipantes: [{ id: TEC_UUID, nombre: 'Juan Perez' }],
        clienteRazonSocial: 'ALICORP S.A.A.',
        sedeNombre: 'PLANTA_CALLAO',
        servicioTipo: 'DRT',
        snapshotCatalogos: {
          insumos: [{ nombreHistorico: 'Cipermetrina 25%' }],
          equipos: [{ nombre: 'Nebulizadora ULV' }],
        },
      });
      const inspBorrador = new Inspeccion({
        id: INSP_2_UUID,
        servicioId: SRV_2_UUID,
        codigoInspeccion: 'GAFER-2026-BORRADOR',
        fechaEjecucion: '2026-11-03',
        estado: 'BORRADOR',
        tecnicosParticipantes: [{ id: TEC_UUID, nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorTecnico.mockResolvedValue([inspCerrada, inspBorrador]);

      const res = await controller.listarMisServicios(usuarioTecnico);

      expect(mockObtener.ejecutarPorTecnico).toHaveBeenCalledWith(TEC_UUID);
      expect(res).toHaveLength(1);
      const validado = ResumenServicioTecnicoSchema.parse(res[0]);
      expect(validado.id).toBe(INSP_1_UUID);
      expect(validado.puedeSolicitarCorreccion).toBe(true);
      expect(validado.clienteRazonSocial).toBe('ALICORP S.A.A.');
      expect(validado.sedeNombre).toBe('PLANTA_CALLAO');
      expect(validado.servicioTipo).toBe('DRT');
      expect(validado.snapshotCatalogos).toEqual({
        insumos: [{ nombreHistorico: 'Cipermetrina 25%' }],
        equipos: [{ nombre: 'Nebulizadora ULV' }],
      });
    });

    it('debe listar todas las inspecciones cerradas cuando el rol es ADMINISTRADOR', async () => {
      const insp1 = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-001',
        fechaEjecucion: '2026-11-03',
        estado: 'CERRADO',
      });
      const insp2 = new Inspeccion({
        id: INSP_2_UUID,
        servicioId: SRV_2_UUID,
        codigoInspeccion: 'GAFER-2026-002',
        fechaEjecucion: '2026-11-03',
        estado: 'CERRADO',
      });
      mockObtener.ejecutarTodas.mockResolvedValue([insp1, insp2]);

      const res = await controller.listarMisServicios(usuarioAdmin);

      expect(mockObtener.ejecutarTodas).toHaveBeenCalled();
      expect(res).toHaveLength(2);
      res.forEach((item) => expect(() => ResumenServicioTecnicoSchema.parse(item)).not.toThrow());
    });

    it('debe denegar con ForbiddenException a un técnico que consulta por servicioId una inspección ajena (F4)', async () => {
      const inspAjena = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-AJENA',
        fechaEjecucion: '2026-11-03',
        tecnicosParticipantes: [{ id: OTRO_TEC_UUID, nombre: 'Carlos Ruiz' }],
      });
      mockObtener.ejecutarPorServicioId.mockResolvedValue(inspAjena);

      await expect(controller.consultar(SRV_1_UUID, usuarioTecnico)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('debe permitir consultar por servicioId al técnico participante o al administrador (F4)', async () => {
      const inspPropia = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-PROPIA',
        fechaEjecucion: '2026-11-03',
        tecnicosParticipantes: [{ id: TEC_UUID, nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorServicioId.mockResolvedValue(inspPropia);

      const resTec = await controller.consultar(SRV_1_UUID, usuarioTecnico);
      expect(resTec?.id).toBe(INSP_1_UUID);

      const resAdmin = await controller.consultar(SRV_1_UUID, usuarioAdmin);
      expect(resAdmin?.id).toBe(INSP_1_UUID);
    });

    it('debe denegar con ForbiddenException a un técnico que intenta consultar inspección ajena', async () => {
      const inspAjena = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_2_UUID,
        codigoInspeccion: 'GAFER-2026-AJENA',
        fechaEjecucion: '2026-11-03',
        tecnicosParticipantes: [{ id: OTRO_TEC_UUID, nombre: 'Carlos Ruiz' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspAjena);

      await expect(
        controller.obtenerPorId(INSP_1_UUID, usuarioTecnico),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir consultar por ID si el técnico participó en la inspección', async () => {
      const inspPropia = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-PROPIA',
        fechaEjecucion: '2026-11-03',
        tecnicosParticipantes: [{ id: TEC_UUID, nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspPropia);

      const res = await controller.obtenerPorId(INSP_1_UUID, usuarioTecnico);
      expect(res.id).toBe(INSP_1_UUID);
    });

    it('debe rechazar solicitud de corrección si la inspección no está CERRADA', async () => {
      const inspBorrador = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-BORRADOR',
        fechaEjecucion: '2026-11-03',
        estado: 'BORRADOR',
        tecnicosParticipantes: [{ id: TEC_UUID, nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspBorrador);

      await expect(
        controller.solicitarCorreccion(
          INSP_1_UUID,
          { motivo: 'Se equivocó de fecha' },
          usuarioTecnico,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar solicitud de corrección si el técnico no participó en la inspección', async () => {
      const inspCerradaAjena = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-CERRADA-AJENA',
        fechaEjecucion: '2026-11-03',
        estado: 'CERRADO',
        tecnicosParticipantes: [{ id: OTRO_TEC_UUID, nombre: 'Pedro Gomez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspCerradaAjena);

      await expect(
        controller.solicitarCorreccion(
          INSP_1_UUID,
          { motivo: 'Corregir estación 12' },
          usuarioTecnico,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe procesar exitosamente la solicitud de corrección y registrar en auditoría', async () => {
      const inspCerrada = new Inspeccion({
        id: INSP_1_UUID,
        servicioId: SRV_1_UUID,
        codigoInspeccion: 'GAFER-2026-CERRADA',
        fechaEjecucion: '2026-11-03',
        estado: 'CERRADO',
        tecnicosParticipantes: [{ id: TEC_UUID, nombre: 'Juan Perez' }],
      });
      mockObtener.ejecutarPorId.mockResolvedValue(inspCerrada);

      const res = await controller.solicitarCorreccion(
        INSP_1_UUID,
        { motivo: 'Se ingresó erróneamente el número de estación 12 en vez de la 14' },
        usuarioTecnico,
      );

      expect(res.ok).toBe(true);
      expect(res.inspeccionId).toBe(INSP_1_UUID);
      expect(mockAuditoria.persistirInspeccionAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          inspeccionId: INSP_1_UUID,
          actorId: TEC_UUID,
          accion: 'SOLICITUD_CORRECCION',
        }),
      );
      expect(mockAuditoria.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'operaciones',
          accion: 'SOLICITAR_CORRECCION',
          entidadId: INSP_1_UUID,
        }),
      );
    });
  });
});
