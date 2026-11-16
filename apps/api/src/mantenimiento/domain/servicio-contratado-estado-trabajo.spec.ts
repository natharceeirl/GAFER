import { EstadoTrabajo } from '@gafer/contracts';
import { MotivoObligatorioError, ServicioContratado, TransicionEstadoTrabajoError } from './servicio-contratado';

/** GAF-99: estado del trabajo del servicio contratado, aparte de la baja lógica ACTIVO / INACTIVO. */
describe('ServicioContratado — estado de trabajo (GAF-99)', () => {
  const MOTIVO = 'El cliente pidió suspender';

  function servicio(estadoTrabajo?: EstadoTrabajo, estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO') {
    return new ServicioContratado({
      proyectoId: 'p1',
      tipoServicio: 'DRT',
      frecuencia: 'QUINCENAL',
      areaTotalM2: 500,
      areaTratarM2: 300,
      estado,
      estadoTrabajo,
    });
  }

  it('un servicio nuevo nace PENDIENTE', () => {
    expect(servicio().getEstadoTrabajo()).toBe('PENDIENTE');
  });

  it('recorre el camino normal PENDIENTE → EN_CURSO → COMPLETADO y devuelve el valor anterior y el nuevo', () => {
    const s = servicio();
    expect(s.cambiarEstadoTrabajo('EN_CURSO')).toEqual({ anterior: 'PENDIENTE', nuevo: 'EN_CURSO', reapertura: false });
    expect(s.cambiarEstadoTrabajo('COMPLETADO')).toEqual({ anterior: 'EN_CURSO', nuevo: 'COMPLETADO', reapertura: false });
    expect(s.getEstadoTrabajo()).toBe('COMPLETADO');
  });

  it.each<EstadoTrabajo>(['PENDIENTE', 'EN_CURSO'])('cancela desde %s con motivo', (desde) => {
    const s = servicio(desde);
    expect(s.cambiarEstadoTrabajo('CANCELADO', MOTIVO)).toEqual({ anterior: desde, nuevo: 'CANCELADO', reapertura: false });
  });

  it.each<[EstadoTrabajo, EstadoTrabajo]>([
    ['PENDIENTE', 'COMPLETADO'],
    ['PENDIENTE', 'PENDIENTE'],
    ['EN_CURSO', 'PENDIENTE'],
    ['EN_CURSO', 'EN_CURSO'],
    ['COMPLETADO', 'PENDIENTE'],
    ['COMPLETADO', 'CANCELADO'],
    ['COMPLETADO', 'COMPLETADO'],
    ['CANCELADO', 'PENDIENTE'],
    ['CANCELADO', 'COMPLETADO'],
    ['CANCELADO', 'CANCELADO'],
  ])('rechaza la transición %s → %s sin cambiar el estado', (desde, hacia) => {
    const s = servicio(desde);
    expect(() => s.cambiarEstadoTrabajo(hacia, MOTIVO)).toThrow(TransicionEstadoTrabajoError);
    expect(() => s.cambiarEstadoTrabajo(hacia, MOTIVO)).toThrow(/no se puede pasar/i);
    expect(s.getEstadoTrabajo()).toBe(desde);
  });

  it.each<EstadoTrabajo>(['COMPLETADO', 'CANCELADO'])('reabre %s a EN_CURSO con motivo y lo marca como reapertura', (desde) => {
    const s = servicio(desde);
    expect(s.cambiarEstadoTrabajo('EN_CURSO', 'Faltó tratar el almacén')).toEqual({ anterior: desde, nuevo: 'EN_CURSO', reapertura: true });
  });

  it.each<[EstadoTrabajo, EstadoTrabajo, string | undefined]>([
    ['PENDIENTE', 'CANCELADO', undefined],
    ['EN_CURSO', 'CANCELADO', '   '],
    ['EN_CURSO', 'CANCELADO', 'abcd'],
    ['COMPLETADO', 'EN_CURSO', undefined],
    ['CANCELADO', 'EN_CURSO', ' abc '],
  ])('%s → %s exige un motivo de al menos 5 caracteres (recibió %p)', (desde, hacia, motivo) => {
    const s = servicio(desde);
    expect(() => s.cambiarEstadoTrabajo(hacia, motivo)).toThrow(MotivoObligatorioError);
    expect(s.getEstadoTrabajo()).toBe(desde);
  });

  it('iniciar y completar no exigen motivo', () => {
    const s = servicio();
    expect(() => s.cambiarEstadoTrabajo('EN_CURSO')).not.toThrow();
    expect(() => s.cambiarEstadoTrabajo('COMPLETADO')).not.toThrow();
  });

  it('un servicio dado de baja (INACTIVO) no cambia de estado de trabajo', () => {
    const s = servicio('PENDIENTE', 'INACTIVO');
    expect(() => s.cambiarEstadoTrabajo('EN_CURSO')).toThrow(/inactivo/i);
    expect(s.getEstadoTrabajo()).toBe('PENDIENTE');
  });

  it('activar y desactivar no tocan el estado de trabajo', () => {
    const s = servicio('EN_CURSO');
    s.desactivar();
    s.activar();
    expect(s.getEstadoTrabajo()).toBe('EN_CURSO');
  });

  it('rechaza un estado de trabajo desconocido al reconstruir el servicio', () => {
    expect(() => servicio('ACTIVO' as EstadoTrabajo)).toThrow(/estado de trabajo no válido/i);
  });
});
