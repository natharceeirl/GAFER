import { describe, expect, it } from 'vitest';
import { EquipoActualizacionSchema, EquipoRegistroSchema, type Equipo } from '@gafer/contracts';
import { ErrorApi } from '../../../shared/api/errores';
import { actualizacionDeEquipo, camposDeErrorEquipo, campoDeRutaEquipo, datosDeEquipo, registroDeEquipo, type DatosEquipo } from './equipo-mapper';

const equipo: Equipo = {
  id: '22222222-2222-4222-8222-222222222222',
  codigoInterno: 'EQ-022',
  nombre: 'Aspersora de mochila 20L',
  tipo: 'ASPERSION',
  marcaModelo: null,
  estadoOperativo: 'MANTENIMIENTO',
  fechaAdquisicion: '2024-03-10',
  ultimoMantenimiento: null,
  proximoMantenimiento: '2026-12-01',
};

const datos: DatosEquipo = {
  codigoInterno: ' eq-022 ',
  nombre: 'Aspersora de mochila 20L',
  tipo: 'ASPERSION',
  marcaModelo: '',
  fechaAdquisicion: '2024-03-10',
  ultimoMantenimiento: '',
  proximoMantenimiento: '2026-12-01',
};

describe('equipo-mapper', () => {
  it('lleva el equipo del API a los datos del formulario (nulos son texto vacío)', () => {
    expect(datosDeEquipo(equipo)).toEqual({
      codigoInterno: 'EQ-022',
      nombre: 'Aspersora de mochila 20L',
      tipo: 'ASPERSION',
      marcaModelo: '',
      fechaAdquisicion: '2024-03-10',
      ultimoMantenimiento: '',
      proximoMantenimiento: '2026-12-01',
    });
  });

  it('arma el alta con el código en mayúsculas, fechas vacías como nulas y sin estado (lo fija el servidor)', () => {
    const cuerpo = registroDeEquipo(datos);
    expect(cuerpo).toEqual({
      codigoInterno: 'EQ-022',
      nombre: 'Aspersora de mochila 20L',
      tipo: 'ASPERSION',
      marcaModelo: null,
      fechaAdquisicion: '2024-03-10',
      ultimoMantenimiento: null,
      proximoMantenimiento: '2026-12-01',
    });
    expect(EquipoRegistroSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('la edición no manda el estado operativo: tiene su propia ruta', () => {
    const cuerpo = actualizacionDeEquipo(datos);
    expect(cuerpo).not.toHaveProperty('estadoOperativo');
    expect(EquipoActualizacionSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('traduce rutas del API y reparte los errores', () => {
    expect(campoDeRutaEquipo('codigoInterno')).toBe('codigoInterno');
    expect(campoDeRutaEquipo('estadoOperativo')).toBeNull();
    const validacion = new ErrorApi({ tipo: 'validacion', mensaje: 'x', campos: { fechaAdquisicion: 'Fecha inválida' } });
    expect(camposDeErrorEquipo(validacion).campos).toEqual({ fechaAdquisicion: 'Fecha inválida' });
  });

  it('un 409 por código interno repetido marca ese campo', () => {
    const error = new ErrorApi({ tipo: 'conflicto', mensaje: 'Ya existe un equipo registrado con el código interno: EQ-022' });
    expect(camposDeErrorEquipo(error).campos.codigoInterno).toMatch(/código interno/i);
  });
});
