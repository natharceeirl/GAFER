import { describe, expect, it } from 'vitest';
import { accionesDeEstadoTrabajo, estadoDeSede } from './estado-trabajo';
import type { ServicioContratado } from './servicio-mapper';

const servicio = (
  estadoTrabajo: ServicioContratado['estadoTrabajo'],
  estado: ServicioContratado['estado'] = 'ACTIVO',
  estadoVisible: ServicioContratado['estadoVisible'] = estadoTrabajo,
) => ({ estado, estadoTrabajo, estadoVisible }) as ServicioContratado;

describe('acciones de estado de trabajo por estado guardado (GAF-99)', () => {
  it('un servicio programado se puede marcar ejecutado o cancelar (con motivo)', () => {
    expect(accionesDeEstadoTrabajo('PROGRAMADO')).toEqual([
      { id: 'ejecutar', etiqueta: 'Marcar ejecutado', destino: 'EJECUTADO', pideMotivo: false },
      { id: 'cancelar', etiqueta: 'Cancelar', destino: 'CANCELADO', pideMotivo: true },
    ]);
  });

  it('un servicio ejecutado se puede marcar concluido o cancelar', () => {
    expect(accionesDeEstadoTrabajo('EJECUTADO').map((a) => [a.etiqueta, a.destino, a.pideMotivo])).toEqual([
      ['Marcar concluido', 'CONCLUIDO', false],
      ['Cancelar', 'CANCELADO', true],
    ]);
  });

  it.each(['CONCLUIDO', 'CANCELADO'] as const)('un servicio %s solo se puede reabrir, con motivo', (estado) => {
    expect(accionesDeEstadoTrabajo(estado)).toEqual([{ id: 'reabrir', etiqueta: 'Reabrir', destino: 'EJECUTADO', pideMotivo: true }]);
  });

  it('ninguna acción deja el servicio en PENDIENTE: ese estado no se fija a mano', () => {
    for (const estado of ['PROGRAMADO', 'EJECUTADO', 'CONCLUIDO', 'CANCELADO'] as const) {
      expect(accionesDeEstadoTrabajo(estado).map((a) => a.destino)).not.toContain('PENDIENTE');
    }
  });
});

describe('estado de la sede derivado de sus servicios activos', () => {
  it('ignora los servicios dados de baja', () => {
    expect(estadoDeSede([servicio('EJECUTADO', 'INACTIVO'), servicio('PROGRAMADO')])).toBe('PROGRAMADO');
  });

  it('sin servicios activos no hay estado', () => {
    expect(estadoDeSede([])).toBeNull();
    expect(estadoDeSede([servicio('CONCLUIDO', 'INACTIVO')])).toBeNull();
  });

  it('aplica la regla de contratos', () => {
    expect(estadoDeSede([servicio('CONCLUIDO'), servicio('CANCELADO')])).toBe('CONCLUIDO');
    expect(estadoDeSede([servicio('EJECUTADO'), servicio('PROGRAMADO')])).toBe('EJECUTADO');
  });

  it('usa el estado visible: un servicio vencido deja la sede pendiente', () => {
    expect(estadoDeSede([servicio('PROGRAMADO', 'ACTIVO', 'PENDIENTE'), servicio('PROGRAMADO')])).toBe('PENDIENTE');
  });
});
