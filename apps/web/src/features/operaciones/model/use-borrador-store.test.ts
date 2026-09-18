import { beforeEach, describe, expect, it } from 'vitest';
import { useBorradorStore } from './use-borrador-store';

describe('useBorradorStore', () => {
  beforeEach(() => {
    useBorradorStore.getState().limpiar();
  });

  it('inicia un borrador vacío para un servicio', () => {
    useBorradorStore.getState().iniciarBorrador('servicio-1');
    expect(useBorradorStore.getState().borrador).toEqual({
      servicioId: 'servicio-1',
      observaciones: '',
    });
  });

  it('actualiza las observaciones sin tocar el servicioId', () => {
    useBorradorStore.getState().iniciarBorrador('servicio-1');
    useBorradorStore.getState().actualizarObservaciones('Se detectó actividad en zona A');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe(
      'Se detectó actividad en zona A',
    );
    expect(useBorradorStore.getState().borrador?.servicioId).toBe('servicio-1');
  });

  it('marca la cola de sincronización sin borrar el borrador', () => {
    useBorradorStore.getState().iniciarBorrador('servicio-1');
    useBorradorStore.getState().marcarComoPendienteDeSincronizar();
    expect(useBorradorStore.getState().colaEnvioPendiente).toBe(true);
    expect(useBorradorStore.getState().borrador).not.toBeNull();
  });

  it('limpiar() borra tanto el borrador como la cola pendiente', () => {
    useBorradorStore.getState().iniciarBorrador('servicio-1');
    useBorradorStore.getState().marcarComoPendienteDeSincronizar();
    useBorradorStore.getState().limpiar();
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(useBorradorStore.getState().colaEnvioPendiente).toBe(false);
  });
});
