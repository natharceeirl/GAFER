import { describe, expect, it } from 'vitest';
import {
  CambioEstadoTrabajoSchema,
  EstadoTrabajoSchema,
  MOTIVO_MINIMO_CARACTERES,
  estadoTrabajoDeSede,
} from './estado-trabajo';
import { ServicioContratadoDetalleSchema } from './servicio';
import { esperarFallaEn, rutasInvalidas } from './pruebas';

describe('EstadoTrabajoSchema', () => {
  it('acepta los cuatro estados de trabajo del servicio', () => {
    for (const estado of ['PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO']) {
      expect(EstadoTrabajoSchema.safeParse(estado).success).toBe(true);
    }
  });

  it('rechaza la baja lógica y las etiquetas de pantalla', () => {
    expect(EstadoTrabajoSchema.safeParse('ACTIVO').success).toBe(false);
    expect(EstadoTrabajoSchema.safeParse('En curso').success).toBe(false);
  });
});

describe('CambioEstadoTrabajoSchema', () => {
  it('acepta iniciar y completar sin motivo', () => {
    expect(CambioEstadoTrabajoSchema.safeParse({ estado: 'EN_CURSO' }).success).toBe(true);
    expect(CambioEstadoTrabajoSchema.safeParse({ estado: 'COMPLETADO' }).success).toBe(true);
  });

  it('cancelar exige motivo', () => {
    esperarFallaEn(CambioEstadoTrabajoSchema, { estado: 'CANCELADO' }, 'motivo');
    expect(CambioEstadoTrabajoSchema.safeParse({ estado: 'CANCELADO', motivo: 'El cliente suspendió el contrato' }).success).toBe(true);
  });

  it(`el motivo tiene al menos ${MOTIVO_MINIMO_CARACTERES} caracteres sin contar espacios de los extremos`, () => {
    esperarFallaEn(CambioEstadoTrabajoSchema, { estado: 'CANCELADO', motivo: '  abc  ' }, 'motivo');
    esperarFallaEn(CambioEstadoTrabajoSchema, { estado: 'EN_CURSO', motivo: 'abcd' }, 'motivo');
    const res = CambioEstadoTrabajoSchema.safeParse({ estado: 'CANCELADO', motivo: '  Lluvia  ' });
    expect(res.success && res.data.motivo).toBe('Lluvia');
  });

  it('rechaza un estado desconocido', () => {
    expect(rutasInvalidas(CambioEstadoTrabajoSchema, { estado: 'CERRADO' })).toEqual(['estado']);
  });
});

describe('estadoTrabajoDeSede (estado derivado, no se guarda)', () => {
  it('sin servicios no hay estado', () => expect(estadoTrabajoDeSede([])).toBeNull());

  it('si algún servicio está en curso, la sede está en curso', () => {
    expect(estadoTrabajoDeSede(['PENDIENTE', 'EN_CURSO', 'COMPLETADO'])).toBe('EN_CURSO');
  });

  it('si todos están pendientes (o pendientes y cancelados), la sede está pendiente', () => {
    expect(estadoTrabajoDeSede(['PENDIENTE', 'PENDIENTE'])).toBe('PENDIENTE');
    expect(estadoTrabajoDeSede(['PENDIENTE', 'CANCELADO'])).toBe('PENDIENTE');
  });

  it('si hay trabajo terminado y trabajo pendiente, la sede está en curso', () => {
    expect(estadoTrabajoDeSede(['COMPLETADO', 'PENDIENTE'])).toBe('EN_CURSO');
  });

  it('si todos terminaron y al menos uno se completó, la sede está completada', () => {
    expect(estadoTrabajoDeSede(['COMPLETADO', 'CANCELADO'])).toBe('COMPLETADO');
    expect(estadoTrabajoDeSede(['COMPLETADO'])).toBe('COMPLETADO');
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
    expect(ServicioContratadoDetalleSchema.safeParse({ ...detalle, estadoTrabajo: 'EN_CURSO' }).success).toBe(true);
  });

  it('sigue aceptando la respuesta de un servidor anterior sin estado de trabajo', () => {
    expect(ServicioContratadoDetalleSchema.safeParse(detalle).success).toBe(true);
  });

  it('rechaza un estado de trabajo desconocido', () => {
    esperarFallaEn(ServicioContratadoDetalleSchema, { ...detalle, estadoTrabajo: 'ACTIVO' }, 'estadoTrabajo');
  });
});
