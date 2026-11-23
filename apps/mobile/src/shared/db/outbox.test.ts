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

  describe('OutboxQueue con persistencia nativa SQLite (Guía Rev 2 §6.1)', () => {
    it('persiste operaciones en sync_outbox con los 18 campos y sobrevive al reinicio de la app', async () => {
      const { MemorySqliteAdapter, ejecutarMigraciones } = await import('./sqlite');
      const db = new MemorySqliteAdapter();
      await ejecutarMigraciones(db);

      const queue1 = new OutboxQueue(db);
      await queue1.encolar(dummyOperacion, {
        deviceId: 'terminal-android-01',
        aggregateType: 'INSPECCION',
        aggregateSeq: 1,
        priority: 'HIGH',
      });

      // Verificar directamente en SQLite que se guardó en la tabla sync_outbox
      const fila = await db.getFirstAsync<{
        operation_id: string;
        device_id: string;
        user_id: string;
        status: string;
        priority: string;
      }>('SELECT * FROM sync_outbox WHERE operation_id = ?;', [dummyOperacion.operationId]);

      expect(fila).not.toBeNull();
      expect(fila?.operation_id).toBe(dummyOperacion.operationId);
      expect(fila?.device_id).toBe('terminal-android-01');
      expect(fila?.user_id).toBe(dummyOperacion.actorId);
      expect(fila?.status).toBe('PENDING');
      expect(fila?.priority).toBe('HIGH');

      // Simular reinicio de la aplicación (crear nueva cola leyendo desde la base de datos)
      const queue2 = new OutboxQueue(db);
      await queue2.inicializar();
      const pendientes = queue2.obtenerPendientes();

      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].operacion.operationId).toBe(dummyOperacion.operationId);
      expect(pendientes[0].operacion.tipo).toBe('REGISTRO_ESTACION');
      expect(pendientes[0].sincronizado).toBe(false);
    });

    it('actualiza estado a SYNCED en SQLite y limpia operaciones tras envio exitoso', async () => {
      const { MemorySqliteAdapter, ejecutarMigraciones } = await import('./sqlite');
      const db = new MemorySqliteAdapter();
      await ejecutarMigraciones(db);

      const queue = new OutboxQueue(db);
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

      await queue.enviarLote('http://localhost:3000', dummyOperacion.agregadoId, mockFetch as any);

      // Debe haberse eliminado de sync_outbox por limpieza de confirmados (comprobación más abajo)
      const fila = await db.getFirstAsync('SELECT * FROM sync_outbox WHERE operation_id = ?;', [
        dummyOperacion.operationId,
      ]);
      expect(fila).toBeNull();
      expect(queue.obtenerPendientes()).toHaveLength(0);
    });
  });

  describe('orden de envío (hallazgo 4 del PR #29)', () => {
    const inspeccionA = '22222222-2222-2222-2222-22222222aaaa';
    const inspeccionB = '22222222-2222-2222-2222-22222222bbbb';

    function op(n: number, agregadoId: string): OperacionSync {
      return {
        ...dummyOperacion,
        operationId: `11111111-1111-1111-1111-${String(n).padStart(12, '0')}`,
        agregadoId,
        payload: { numeroEstacion: n, huboConsumo: false },
      };
    }

    async function crearCola() {
      const { MemorySqliteAdapter, ejecutarMigraciones } = await import('./sqlite');
      const db = new MemorySqliteAdapter();
      await ejecutarMigraciones(db);
      return { db, queue: new OutboxQueue(db) };
    }

    function respuestaOk(procesadas: string[], inspeccionId: string) {
      return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          inspeccionId,
          procesadas,
          omitidasIdempotentes: [],
          conflictos: [],
          serverReceivedAt: '2026-09-20T18:00:01.000Z',
        }),
      });
    }

    it('numera la secuencia por inspección, no por el total de la cola', async () => {
      const { queue } = await crearCola();
      const a1 = await queue.encolar(op(1, inspeccionA));
      const b1 = await queue.encolar(op(2, inspeccionB));
      const a2 = await queue.encolar(op(3, inspeccionA));

      expect([a1.aggregateSeq, a2.aggregateSeq]).toEqual([1, 2]);
      expect(b1.aggregateSeq).toBe(1);
    });

    it('operaciones de distinto tipo sobre la misma inspección comparten la secuencia y el orden', async () => {
      const { queue } = await crearCola();
      const estacion = await queue.encolar(op(1, inspeccionA), {
        aggregateType: 'ESTACION_CONTROL',
        priority: 'NORMAL',
      });
      const acta = await queue.encolar(op(2, inspeccionA), {
        aggregateType: 'SERVICIO_DRT',
        priority: 'HIGH',
      });

      expect(estacion.aggregateSeq).toBe(1);
      expect(acta.aggregateSeq).toBe(2);

      const fetchMock = respuestaOk([], inspeccionA);
      await queue.enviarLote('http://api', inspeccionA, fetchMock as any);
      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo.operaciones.map((o: OperacionSync) => o.payload.numeroEstacion)).toEqual([1, 2]);
    });

    it('la secuencia no retrocede tras limpiar las sincronizadas ni al reiniciar la app', async () => {
      const { db, queue } = await crearCola();
      await queue.encolar(op(1, inspeccionA));
      await queue.encolar(op(2, inspeccionA));
      await queue.encolar(op(3, inspeccionA));

      // Se sincronizan y limpian las tres: la tabla y la cola en memoria quedan vacías.
      await queue.enviarLote('http://api', inspeccionA, respuestaOk(
        [op(1, inspeccionA), op(2, inspeccionA), op(3, inspeccionA)].map((o) => o.operationId),
        inspeccionA,
      ) as any);
      expect(queue.obtenerPendientes()).toHaveLength(0);

      const cuarta = await queue.encolar(op(4, inspeccionA));
      expect(cuarta.aggregateSeq).toBe(4);

      // Reinicio: una cola nueva sobre la misma base sigue la numeración.
      const reiniciada = new OutboxQueue(db);
      await reiniciada.inicializar();
      const quinta = await reiniciada.encolar(op(5, inspeccionA));
      expect(quinta.aggregateSeq).toBe(5);
    });

    it('tras reiniciar la app envía las operaciones de una inspección en orden de secuencia', async () => {
      const { db, queue } = await crearCola();
      await queue.encolar(op(1, inspeccionA), { priority: 'NORMAL' });
      await queue.encolar(op(2, inspeccionA), { priority: 'CRITICAL' });
      await queue.encolar(op(3, inspeccionA), { priority: 'HIGH' });

      const reiniciada = new OutboxQueue(db);
      await reiniciada.inicializar();
      const fetchMock = respuestaOk([], inspeccionA);
      await reiniciada.enviarLote('http://api', inspeccionA, fetchMock as any);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo.operaciones.map((o: OperacionSync) => o.payload.numeroEstacion)).toEqual([
        1, 2, 3,
      ]);
    });

    it('encolar dos veces la misma operación no la duplica ni cambia su secuencia', async () => {
      const { db, queue } = await crearCola();
      const primera = await queue.encolar(op(1, inspeccionA));
      const repetida = await queue.encolar(op(1, inspeccionA));

      // Otra instancia (p. ej. tras reinicio sin inicializar) tampoco la duplica.
      const otra = new OutboxQueue(db);
      const desdeOtra = await otra.encolar(op(1, inspeccionA));

      expect(repetida.aggregateSeq).toBe(primera.aggregateSeq);
      expect(desdeOtra.aggregateSeq).toBe(primera.aggregateSeq);
      const filas = await db.getAllAsync('SELECT * FROM sync_outbox;');
      expect(filas).toHaveLength(1);
    });
  });

  describe('consistencia memoria vs SQLite ante errores de escritura (F5)', () => {
    it('marcarSincronizadas no muta la cola en memoria si falla la transacción SQLite', async () => {
      const { MemorySqliteAdapter, ejecutarMigraciones } = await import('./sqlite');
      const db = new MemorySqliteAdapter();
      await ejecutarMigraciones(db);

      const queue = new OutboxQueue(db);
      await queue.encolar(dummyOperacion);

      const spyTx = vi
        .spyOn(db, 'withExclusiveTransactionAsync')
        .mockRejectedValueOnce(new Error('SQLITE_FULL'));

      await expect(queue.marcarSincronizadas([dummyOperacion.operationId])).rejects.toThrow(
        'SQLITE_FULL',
      );
      spyTx.mockRestore();

      // La operación sigue pendiente tanto en memoria como en SQLite.
      expect(queue.obtenerPendientes()).toHaveLength(1);
      expect(queue.obtenerPendientes()[0].sincronizado).toBe(false);
      const fila = await db.getFirstAsync<{ status: string }>(
        'SELECT status FROM sync_outbox WHERE operation_id = ?;',
        [dummyOperacion.operationId],
      );
      expect(fila?.status).toBe('PENDING');
    });

    it('limpiarSincronizados no descarta la cola en memoria si falla el DELETE en SQLite', async () => {
      const { MemorySqliteAdapter, ejecutarMigraciones } = await import('./sqlite');
      const db = new MemorySqliteAdapter();
      await ejecutarMigraciones(db);

      const queue = new OutboxQueue(db);
      await queue.encolar(dummyOperacion);
      await queue.marcarSincronizadas([dummyOperacion.operationId]);

      const spyTx = vi
        .spyOn(db, 'withExclusiveTransactionAsync')
        .mockRejectedValueOnce(new Error('SQLITE_IOERR'));

      await expect(queue.limpiarSincronizados()).rejects.toThrow('SQLITE_IOERR');
      spyTx.mockRestore();

      // La fila sigue en SQLite y en la cola en memoria (encolar devuelve el registro en memoria sin tocar SQLite).
      const spyEncolarTx = vi.spyOn(db, 'withExclusiveTransactionAsync');
      const enMemoria = await queue.encolar(dummyOperacion);
      expect(spyEncolarTx).not.toHaveBeenCalled();
      expect(enMemoria.sincronizado).toBe(true);
      spyEncolarTx.mockRestore();

      const fila = await db.getFirstAsync<{ status: string }>(
        'SELECT status FROM sync_outbox WHERE operation_id = ?;',
        [dummyOperacion.operationId],
      );
      expect(fila?.status).toBe('SYNCED');
    });
  });
});
