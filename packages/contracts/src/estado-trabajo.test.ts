import { describe, expect, it } from 'vitest';
import {
  CambioEstadoTrabajoSchema,
  EstadoTrabajoSchema,
  EstadoVisibleTrabajoSchema,
  MOTIVO_MINIMO_CARACTERES,
  estadoTrabajoDeSede,
  estadoVisibleDeServicio,
} from './estado-trabajo';
import { ServicioContratadoDetalleSchema } from './servicio';
import { esperarFallaEn, rutasInvalidas } from './pruebas';

describe('EstadoTrabajoSchema', () => {
  it('acepta los cuatro estados guardados del servicio', () => {
    for (const estado of ['PROGRAMADO', 'EJECUTADO', 'CONCLUIDO', 'CANCELADO']) {
      expect(EstadoTrabajoSchema.safeParse(estado).success).toBe(true);
    }
  });

  it('PENDIENTE no se guarda: es un estado derivado', () => {
    expect(EstadoTrabajoSchema.safeParse('PENDIENTE').success).toBe(false);
    expect(EstadoTrabajoSchema.safeParse('EN_CURSO').success).toBe(false);
  });

  it('rechaza la baja lógica y las etiquetas de pantalla', () => {
    expect(EstadoTrabajoSchema.safeParse('ACTIVO').success).toBe(false);
    expect(EstadoTrabajoSchema.safeParse('En curso').success).toBe(false);
  });
});

describe('CambioEstadoTrabajoSchema', () => {
  it('acepta ejecutar y concluir sin motivo', () => {
    expect(CambioEstadoTrabajoSchema.safeParse({ estado: 'EJECUTADO' }).success).toBe(true);
    expect(CambioEstadoTrabajoSchema.safeParse({ estado: 'CONCLUIDO' }).success).toBe(true);
  });

  it('cancelar exige motivo', () => {
    esperarFallaEn(CambioEstadoTrabajoSchema, { estado: 'CANCELADO' }, 'motivo');
    expect(CambioEstadoTrabajoSchema.safeParse({ estado: 'CANCELADO', motivo: 'El cliente suspendió el contrato' }).success).toBe(true);
  });

  it(`el motivo tiene al menos ${MOTIVO_MINIMO_CARACTERES} caracteres sin contar espacios de los extremos`, () => {
    esperarFallaEn(CambioEstadoTrabajoSchema, { estado: 'CANCELADO', motivo: '  abc  ' }, 'motivo');
    esperarFallaEn(CambioEstadoTrabajoSchema, { estado: 'EJECUTADO', motivo: 'abcd' }, 'motivo');
    const res = CambioEstadoTrabajoSchema.safeParse({ estado: 'CANCELADO', motivo: '  Lluvia  ' });
    expect(res.success && res.data.motivo).toBe('Lluvia');
  });

  it('rechaza un estado desconocido', () => {
    expect(rutasInvalidas(CambioEstadoTrabajoSchema, { estado: 'CERRADO' })).toEqual(['estado']);
  });

  it('el Administrador no puede fijar PENDIENTE a mano', () => {
    expect(rutasInvalidas(CambioEstadoTrabajoSchema, { estado: 'PENDIENTE' })).toEqual(['estado']);
  });
});

describe('EstadoVisibleTrabajoSchema', () => {
  it('suma PENDIENTE a los estados guardados', () => {
    for (const estado of ['PROGRAMADO', 'PENDIENTE', 'EJECUTADO', 'CONCLUIDO', 'CANCELADO']) {
      expect(EstadoVisibleTrabajoSchema.safeParse(estado).success).toBe(true);
    }
    expect(EstadoVisibleTrabajoSchema.safeParse('EN_CURSO').success).toBe(false);
  });
});

describe('estadoVisibleDeServicio (PENDIENTE se deriva, no se guarda)', () => {
  const hoy = '2026-11-24';

  it('es PENDIENTE si está programado y su fecha ya pasó', () => {
    expect(estadoVisibleDeServicio('PROGRAMADO', '2026-11-23', hoy)).toBe('PENDIENTE');
    expect(estadoVisibleDeServicio('PROGRAMADO', '2025-01-01', hoy)).toBe('PENDIENTE');
  });

  it('sigue PROGRAMADO si la fecha es hoy o futura', () => {
    expect(estadoVisibleDeServicio('PROGRAMADO', hoy, hoy)).toBe('PROGRAMADO');
    expect(estadoVisibleDeServicio('PROGRAMADO', '2026-11-25', hoy)).toBe('PROGRAMADO');
  });

  it('sin fecha programada no se puede vencer', () => {
    expect(estadoVisibleDeServicio('PROGRAMADO', null, hoy)).toBe('PROGRAMADO');
    expect(estadoVisibleDeServicio('PROGRAMADO', undefined, hoy)).toBe('PROGRAMADO');
  });

  it('los demás estados no cambian aunque la fecha haya pasado', () => {
    for (const estado of ['EJECUTADO', 'CONCLUIDO', 'CANCELADO'] as const) {
      expect(estadoVisibleDeServicio(estado, '2020-01-01', hoy)).toBe(estado);
    }
  });
});

describe('estadoTrabajoDeSede (estado derivado, no se guarda)', () => {
  it('sin servicios no hay estado', () => expect(estadoTrabajoDeSede([])).toBeNull());

  it('si algún servicio está ejecutado, la sede está ejecutada', () => {
    expect(estadoTrabajoDeSede(['PROGRAMADO', 'EJECUTADO', 'CONCLUIDO'])).toBe('EJECUTADO');
  });

  it('si todos están programados (o programados y cancelados), la sede está programada', () => {
    expect(estadoTrabajoDeSede(['PROGRAMADO', 'PROGRAMADO'])).toBe('PROGRAMADO');
    expect(estadoTrabajoDeSede(['PROGRAMADO', 'CANCELADO'])).toBe('PROGRAMADO');
  });

  it('si algún servicio está pendiente y ninguno ejecutado, la sede está pendiente', () => {
    expect(estadoTrabajoDeSede(['PROGRAMADO', 'PENDIENTE'])).toBe('PENDIENTE');
    expect(estadoTrabajoDeSede(['PENDIENTE', 'CANCELADO'])).toBe('PENDIENTE');
  });

  it('si hay trabajo concluido y trabajo por hacer, la sede está ejecutada', () => {
    expect(estadoTrabajoDeSede(['CONCLUIDO', 'PROGRAMADO'])).toBe('EJECUTADO');
    expect(estadoTrabajoDeSede(['CONCLUIDO', 'PENDIENTE'])).toBe('EJECUTADO');
  });

  it('si todos terminaron y al menos uno se concluyó, la sede está concluida', () => {
    expect(estadoTrabajoDeSede(['CONCLUIDO', 'CANCELADO'])).toBe('CONCLUIDO');
    expect(estadoTrabajoDeSede(['CONCLUIDO'])).toBe('CONCLUIDO');
  });

  it('si todos se cancelaron, la sede está cancelada', () => {
    expect(estadoTrabajoDeSede(['CANCELADO', 'CANCELADO'])).toBe('CANCELADO');
  });
});

describe('ServicioContratadoDetalleSchema con estado de trabajo', () => {
  const detalle = {
    id: '44444444-4444-4444-4444-444444444444',
    proyectoId: '11111111-1111-1111-1111-111111111111',
    tipoServicio: 'DRT',
    frecuencia: 'QUINCENAL',
    areaTotalM2: 500,
    areaTratarM2: 300,
    estado: 'ACTIVO',
  };

  it('acepta el estado de trabajo junto a la baja lógica', () => {
    expect(ServicioContratadoDetalleSchema.safeParse({ ...detalle, estadoTrabajo: 'EJECUTADO' }).success).toBe(true);
  });

  it('acepta el estado visible (con PENDIENTE derivado) y la fecha programada', () => {
    const res = ServicioContratadoDetalleSchema.safeParse({
      ...detalle,
      estadoTrabajo: 'PROGRAMADO',
      estadoVisible: 'PENDIENTE',
      fechaProgramada: '2026-11-01',
    });
    expect(res.success).toBe(true);
    expect(ServicioContratadoDetalleSchema.safeParse({ ...detalle, fechaProgramada: null }).success).toBe(true);
  });

  it('rechaza una fecha programada que no es YYYY-MM-DD', () => {
    esperarFallaEn(ServicioContratadoDetalleSchema, { ...detalle, fechaProgramada: '01/11/2026' }, 'fechaProgramada');
  });

  it('PENDIENTE no es un estado de trabajo guardado', () => {
    esperarFallaEn(ServicioContratadoDetalleSchema, { ...detalle, estadoTrabajo: 'PENDIENTE' }, 'estadoTrabajo');
  });

  it('sigue aceptando la respuesta de un servidor anterior sin estado de trabajo', () => {
    expect(ServicioContratadoDetalleSchema.safeParse(detalle).success).toBe(true);
  });

  it('rechaza un estado de trabajo desconocido', () => {
    esperarFallaEn(ServicioContratadoDetalleSchema, { ...detalle, estadoTrabajo: 'ACTIVO' }, 'estadoTrabajo');
  });
});
