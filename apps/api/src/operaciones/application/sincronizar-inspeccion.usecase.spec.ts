import { SincronizarInspeccionUseCase } from './sincronizar-inspeccion.usecase';
import { Inspeccion } from '../domain/inspeccion';
import { OperacionSync } from '@gafer/contracts';

describe('SincronizarInspeccionUseCase (GAP-02)', () => {
  let useCase: SincronizarInspeccionUseCase;
  let mockInspeccionRepo: any;
  let mockPersonalRepo: any;
  let mockAuditoriaService: any;
  let mockDb: any;

  beforeEach(() => {
    mockInspeccionRepo = {
      buscarPorId: jest.fn(),
    };
    mockPersonalRepo = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'tec-1' }),
    };
    mockAuditoriaService = {
      persistirInspeccionAuditoria: jest.fn().mockResolvedValue(undefined),
      listarPorInspeccion: jest.fn().mockResolvedValue([]),
    };
    mockDb = {
      selectFrom: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([]),
    };

    useCase = new SincronizarInspeccionUseCase(
      mockInspeccionRepo,
      mockPersonalRepo,
      mockAuditoriaService,
      mockDb,
    );
  });

  const dummyOp: OperacionSync = {
    operationId: '11111111-1111-1111-1111-111111111111',
    tipo: 'REGISTRO_ESTACION',
    agregadoId: 'insp-1',
    actorId: 'tec-1',
    clienteTimestamp: '2026-09-20T18:00:00.000Z',
    payload: { numeroEstacion: 1, huboConsumo: true },
  };

  it('procesa operaciones correctamente en una inspeccion en borrador', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    mockInspeccionRepo.buscarPorId.mockResolvedValue(inspeccion);

    const res = await useCase.ejecutar('insp-1', [dummyOp]);

    expect(res.procesadas).toContain(dummyOp.operationId);
    expect(res.omitidasIdempotentes).toHaveLength(0);
    expect(mockAuditoriaService.persistirInspeccionAuditoria).toHaveBeenCalled();
  });

  it('rechaza con ConflictException si la inspeccion esta cerrada', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    inspeccion.cerrar({});
    mockInspeccionRepo.buscarPorId.mockResolvedValue(inspeccion);

    await expect(useCase.ejecutar('insp-1', [dummyOp])).rejects.toThrow(
      'La inspección está cerrada y no acepta más sincronizaciones',
    );
  });

  it('ignora de forma idempotente operaciones ya procesadas', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    mockInspeccionRepo.buscarPorId.mockResolvedValue(inspeccion);

    // Simulamos que la operacion ya estaba en la auditoria previa
    mockAuditoriaService.listarPorInspeccion.mockResolvedValueOnce([
      {
        inspeccion_id: 'insp-1',
        actor_id: 'tec-1',
        accion: 'REGISTRO_ESTACION',
        payload_nuevo: JSON.stringify({ operationId: dummyOp.operationId, numeroEstacion: 1 }),
      },
    ]);

    const res = await useCase.ejecutar('insp-1', [dummyOp]);

    expect(res.omitidasIdempotentes).toContain(dummyOp.operationId);
    expect(res.procesadas).toHaveLength(0);
  });

  it('detecta colisiones sobre la misma estacion y archiva el valor desplazado', async () => {
    const inspeccion = new Inspeccion('insp-1', 'srv-1');
    mockInspeccionRepo.buscarPorId.mockResolvedValue(inspeccion);

    const opTecnicoA: OperacionSync = {
      ...dummyOp,
      operationId: '22222222-2222-2222-2222-222222222222',
      payload: { numeroEstacion: 5, colorAura: 'VERDE' },
    };

    const opTecnicoB: OperacionSync = {
      ...dummyOp,
      operationId: '33333333-3333-3333-3333-333333333333',
      payload: { numeroEstacion: 5, colorAura: 'ROJO' },
    };

    const res = await useCase.ejecutar('insp-1', [opTecnicoA, opTecnicoB]);

    expect(res.procesadas).toHaveLength(2);
    expect(res.conflictos).toHaveLength(1);
    expect(res.conflictos[0].operationId).toBe(opTecnicoB.operationId);
    expect(res.conflictos[0].valorDesplazado).toEqual({ numeroEstacion: 5, colorAura: 'VERDE' });
  });
});
