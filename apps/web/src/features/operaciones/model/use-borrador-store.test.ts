import { beforeEach, describe, expect, it } from 'vitest';
import { useBorradorStore } from './use-borrador-store';
import { crearBorradorVacio } from './tipos';

describe('useBorradorStore', () => {
  beforeEach(() => {
    useBorradorStore.getState().limpiar();
  });

  it('inicia un borrador vacío para un servicio', () => {
    useBorradorStore.getState().iniciarBorrador('servicio-1');
    expect(useBorradorStore.getState().borrador).toEqual(crearBorradorVacio('servicio-1'));
  });

  it('acepta datos iniciales (para reabrir un borrador ya guardado)', () => {
    useBorradorStore.getState().iniciarBorrador('servicio-1', {
      observacionesTecnicas: { catalogo: '', textoLibre: 'Acceso restringido' },
    });
    expect(useBorradorStore.getState().borrador?.observacionesTecnicas.textoLibre).toBe(
      'Acceso restringido',
    );
    expect(useBorradorStore.getState().borrador?.servicioId).toBe('servicio-1');
  });

  it('actualiza un bloque sin tocar el resto del borrador', () => {
    useBorradorStore.getState().iniciarBorrador('servicio-1');
    useBorradorStore.getState().actualizarBloque('condicionesAmbientales', {
      temperaturaC: '27',
      humedadPorc: '60',
      vientoKmh: '5',
    });
    expect(useBorradorStore.getState().borrador?.condicionesAmbientales.temperaturaC).toBe('27');
    expect(useBorradorStore.getState().borrador?.servicioId).toBe('servicio-1');
    expect(useBorradorStore.getState().borrador?.personal).toEqual([]);
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
