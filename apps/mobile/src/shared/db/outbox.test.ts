import { describe, it, expect } from 'vitest';
import { OutboxQueue } from './outbox';

describe('OutboxQueue (Móvil Offline-First)', () => {
  it('encola operaciones con UUID idempotente y estado no sincronizado', () => {
    const queue = new OutboxQueue();
    const op = queue.encolar('REGISTRO_ESTACION', 'estacion-1', { consumo: true });

    expect(op.id).toBeDefined();
    expect(op.sincronizado).toBe(false);
    expect(queue.obtenerPendientes()).toHaveLength(1);
  });

  it('permite marcar operaciones como sincronizadas y limpiarlas', () => {
    const queue = new OutboxQueue();
    const op = queue.encolar('CIERRE_INSPECCION', 'insp-1', {});

    queue.marcarSincronizado(op.id);
    expect(queue.obtenerPendientes()).toHaveLength(0);

    queue.limpiarSincronizados();
    expect(queue.obtenerPendientes()).toHaveLength(0);
  });
});
