import { AuditoriaService } from './auditoria.service';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let mockDb: any;
  let mockPersonalRepo: any;

  beforeEach(() => {
    mockDb = {
      insertInto: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
      selectFrom: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
    };

    mockPersonalRepo = {
      buscarPorId: jest.fn(),
      buscarPorUsuario: jest.fn(),
    };

    service = new AuditoriaService(mockDb, mockPersonalRepo);
  });

  it('debe registrar un evento en memoria', async () => {
    await service.registrar({
      actor: 'tec-1',
      handler: 'cerrar',
      timestamp: '2026-09-20T18:00:00Z',
      camposModificados: { test: true },
    });

    const eventos = service.obtenerEventosMemoria();
    expect(eventos).toHaveLength(1);
    expect(eventos[0].actor).toBe('tec-1');
  });

  it('debe persistir auditoria en inspecciones_auditoria', async () => {
    await service.persistirInspeccionAuditoria({
      inspeccionId: '00000000-0000-0000-0000-000000000001',
      actorId: '00000000-0000-0000-0000-000000000002',
      accion: 'CIERRE',
      payloadNuevo: { consumos: [] },
    });

    expect(mockDb.insertInto).toHaveBeenCalledWith('inspecciones_auditoria');
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        inspeccion_id: '00000000-0000-0000-0000-000000000001',
        actor_id: '00000000-0000-0000-0000-000000000002',
        accion: 'CIERRE',
        payload_nuevo: JSON.stringify({ consumos: [] }),
      }),
    );
  });

  it('debe resolver actorId por UUID o por usuario', async () => {
    mockPersonalRepo.buscarPorId.mockResolvedValueOnce({ id: 'uuid-personal' });
    const resId = await service.resolverActorId('11111111-1111-1111-1111-111111111111');
    expect(resId).toBe('uuid-personal');

    mockPersonalRepo.buscarPorUsuario.mockResolvedValueOnce({ id: 'uuid-por-usuario' });
    const resUser = await service.resolverActorId('JPEREZ');
    expect(resUser).toBe('uuid-por-usuario');
  });
});
