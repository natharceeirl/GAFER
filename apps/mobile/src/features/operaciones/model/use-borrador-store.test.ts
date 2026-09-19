import { describe, it, expect, beforeEach } from 'vitest';
import { useBorradorStore } from './use-borrador-store';

describe('useBorradorStore (Mobile)', () => {
  beforeEach(() => {
    useBorradorStore.getState().limpiar();
  });

  it('inicia un borrador con servicioId y cola en false', () => {
    useBorradorStore.getState().iniciarBorrador('srv-123');
    const state = useBorradorStore.getState();
    expect(state.borrador?.servicioId).toBe('srv-123');
    expect(state.colaEnvioPendiente).toBe(false);
  });

  it('actualiza observaciones del borrador activo', () => {
    useBorradorStore.getState().iniciarBorrador('srv-123');
    useBorradorStore.getState().actualizarObservaciones('Sin novedad en cebadero 1');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Sin novedad en cebadero 1');
  });
});
