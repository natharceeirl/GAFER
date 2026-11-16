import { describe, expect, it } from 'vitest';
import { accionesDeEstadoTrabajo, estadoDeSede } from './estado-trabajo';
import type { ServicioContratado } from './servicio-mapper';

const servicio = (estadoTrabajo: ServicioContratado['estadoTrabajo'], estado: ServicioContratado['estado'] = 'ACTIVO') =>
  ({ estado, estadoTrabajo }) as ServicioContratado;

describe('acciones de estado de trabajo por estado (GAF-99)', () => {
  it('un servicio pendiente se puede iniciar o cancelar (con motivo)', () => {
    expect(accionesDeEstadoTrabajo('PENDIENTE')).toEqual([
      { id: 'iniciar', etiqueta: 'Iniciar', destino: 'EN_CURSO', pideMotivo: false },
      { id: 'cancelar', etiqueta: 'Cancelar', destino: 'CANCELADO', pideMotivo: true },
    ]);
  });

  it('un servicio en curso se puede marcar completado o cancelar', () => {
    expect(accionesDeEstadoTrabajo('EN_CURSO').map((a) => [a.etiqueta, a.destino, a.pideMotivo])).toEqual([
      ['Marcar completado', 'COMPLETADO', false],
      ['Cancelar', 'CANCELADO', true],
    ]);
  });

  it.each(['COMPLETADO', 'CANCELADO'] as const)('un servicio %s solo se puede reabrir, con motivo', (estado) => {
    expect(accionesDeEstadoTrabajo(estado)).toEqual([{ id: 'reabrir', etiqueta: 'Reabrir', destino: 'EN_CURSO', pideMotivo: true }]);
  });
});

describe('estado de la sede derivado de sus servicios activos', () => {
  it('ignora los servicios dados de baja', () => {
    expect(estadoDeSede([servicio('EN_CURSO', 'INACTIVO'), servicio('PENDIENTE')])).toBe('PENDIENTE');
  });

  it('sin servicios activos no hay estado', () => {
    expect(estadoDeSede([])).toBeNull();
    expect(estadoDeSede([servicio('COMPLETADO', 'INACTIVO')])).toBeNull();
  });

  it('aplica la regla de contratos', () => {
    expect(estadoDeSede([servicio('COMPLETADO'), servicio('CANCELADO')])).toBe('COMPLETADO');
    expect(estadoDeSede([servicio('EN_CURSO'), servicio('PENDIENTE')])).toBe('EN_CURSO');
  });
});
