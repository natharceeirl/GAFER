import { describe, it, expect, vi } from 'vitest';
import { OutboxQueue, MemoryOutboxStorage } from './outbox';
import { OperacionSync } from '@gafer/contracts';

describe('OutboxQueue (Móvil Offline-First con sync.v1 - GAP-05)', () => {
  const dummyOperacion: OperacionSync = {
    operationId: '11111111-1111-1111-1111-111111111111',
    tipo: 'REGISTRO_ESTACION',
    agregadoId: '22222222-2222-2222-2222-222222222222',
    actorId: '33333333-3333-3333-3333-333333333333',
    clienteTimestamp: '2026-09-20T18:00:00.000Z',
    payload: { numeroEstacion: 1, huboConsumo: true },
  };

  it('encola operaciones con contrato sync.v1 y estado no sincronizado', async () => {
    const storage = new MemoryOutboxStorage();
    const queue = new OutboxQueue(storage);
    const op = await queue.encolar(dummyOperacion);

    expect(op.operacion.operationId).toBe('11111111-1111-1111-1111-111111111111');
    expect(op.sincronizado).toBe(false);
    expect(queue.obtenerPendientes()).toHaveLength(1);
  });

  it('persiste la cola en storage y la recupera al inicializar', async () => {
    const storage = new MemoryOutboxStorage();
    const queue1 = new OutboxQueue(storage);
    await queue1.encolar(dummyOperacion);

    const queue2 = new OutboxQueue(storage);
    await queue2.inicializar();
    expect(queue2.obtenerPendientes()).toHaveLength(1);
    expect(queue2.obtenerPendientes()[0].operacion.operationId).toBe(dummyOperacion.operationId);
  });

  it('envia un lote al servidor y limpia las operaciones confirmadas', async () => {
    const storage = new MemoryOutboxStorage();
    const queue = new OutboxQueue(storage);
    await queue.encolar(dummyOperacion);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        inspeccionId: dummyOperacion.agregadoId,
        procesadas: [dummyOperacion.operationId],
        omitidasIdempotentes: [],
        conflictos: [],
        serverReceivedAt: '2026-09-20T18:00:01.000Z',
      }),
    });

    const resultado = await queue.enviarLote(
      'http://localhost:3000',
      dummyOperacion.agregadoId,
      mockFetch as any,
    );

    expect(resultado).not.toBeNull();
    expect(resultado?.procesadas).toContain(dummyOperacion.operationId);
    expect(queue.obtenerPendientes()).toHaveLength(0);
  });

  it('incrementa intentos y persiste error cuando la peticion falla', async () => {
    const storage = new MemoryOutboxStorage();
    const queue = new OutboxQueue(storage);
    await queue.encolar(dummyOperacion);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const resultado = await queue.enviarLote(
      'http://localhost:3000',
      dummyOperacion.agregadoId,
      mockFetch as any,
    );

    expect(resultado).toBeNull();
    const pendientes = queue.obtenerPendientes();
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].intentos).toBe(1);
    expect(pendientes[0].ultimoError).toContain('HTTP 500');
  });
});
