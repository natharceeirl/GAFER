import { EstadoTrabajo } from '@gafer/contracts';
import { MotivoObligatorioError, ServicioContratado, TransicionEstadoTrabajoError } from './servicio-contratado';

/** GAF-99: estado del trabajo del servicio contratado, aparte de la baja lógica ACTIVO / INACTIVO. */
describe('ServicioContratado — estado de trabajo (GAF-99)', () => {
  const MOTIVO = 'El cliente pidió suspender';

  function servicio(estadoTrabajo?: EstadoTrabajo, estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO', fechaProgramada?: string | null) {
    return new ServicioContratado({
      proyectoId: 'p1',
      tipoServicio: 'DRT',
      frecuencia: 'QUINCENAL',
      areaTotalM2: 500,
      areaTratarM2: 300,
      estado,
      estadoTrabajo,
      fechaProgramada,
    });
  }

  it('un servicio nuevo nace PROGRAMADO', () => {
    expect(servicio().getEstadoTrabajo()).toBe('PROGRAMADO');
  });

  it('recorre el camino normal PROGRAMADO → EJECUTADO → CONCLUIDO y devuelve el valor anterior y el nuevo', () => {
    const s = servicio();
    expect(s.cambiarEstadoTrabajo('EJECUTADO')).toEqual({ anterior: 'PROGRAMADO', nuevo: 'EJECUTADO', reapertura: false });
    expect(s.cambiarEstadoTrabajo('CONCLUIDO')).toEqual({ anterior: 'EJECUTADO', nuevo: 'CONCLUIDO', reapertura: false });
    expect(s.getEstadoTrabajo()).toBe('CONCLUIDO');
  });

  it.each<EstadoTrabajo>(['PROGRAMADO', 'EJECUTADO'])('cancela desde %s con motivo', (desde) => {
    const s = servicio(desde);
    expect(s.cambiarEstadoTrabajo('CANCELADO', MOTIVO)).toEqual({ anterior: desde, nuevo: 'CANCELADO', reapertura: false });
  });

  it.each<[EstadoTrabajo, EstadoTrabajo]>([
    ['PROGRAMADO', 'CONCLUIDO'],
    ['PROGRAMADO', 'PROGRAMADO'],
    ['EJECUTADO', 'PROGRAMADO'],
    ['EJECUTADO', 'EJECUTADO'],
    ['CONCLUIDO', 'PROGRAMADO'],
    ['CONCLUIDO', 'CANCELADO'],
    ['CONCLUIDO', 'CONCLUIDO'],
    ['CANCELADO', 'PROGRAMADO'],
    ['CANCELADO', 'CONCLUIDO'],
    ['CANCELADO', 'CANCELADO'],
  ])('rechaza la transición %s → %s sin cambiar el estado', (desde, hacia) => {
    const s = servicio(desde);
    expect(() => s.cambiarEstadoTrabajo(hacia, MOTIVO)).toThrow(TransicionEstadoTrabajoError);
    expect(() => s.cambiarEstadoTrabajo(hacia, MOTIVO)).toThrow(/no se puede pasar/i);
    expect(s.getEstadoTrabajo()).toBe(desde);
  });

  it.each<EstadoTrabajo>(['CONCLUIDO', 'CANCELADO'])('reabre %s a EJECUTADO con motivo y lo marca como reapertura', (desde) => {
    const s = servicio(desde);
    expect(s.cambiarEstadoTrabajo('EJECUTADO', 'Faltó tratar el almacén')).toEqual({ anterior: desde, nuevo: 'EJECUTADO', reapertura: true });
  });

  it.each<[EstadoTrabajo, EstadoTrabajo, string | undefined]>([
    ['PROGRAMADO', 'CANCELADO', undefined],
    ['EJECUTADO', 'CANCELADO', '   '],
    ['EJECUTADO', 'CANCELADO', 'abcd'],
    ['CONCLUIDO', 'EJECUTADO', undefined],
    ['CANCELADO', 'EJECUTADO', ' abc '],
  ])('%s → %s exige un motivo de al menos 5 caracteres (recibió %p)', (desde, hacia, motivo) => {
    const s = servicio(desde);
    expect(() => s.cambiarEstadoTrabajo(hacia, motivo)).toThrow(MotivoObligatorioError);
    expect(s.getEstadoTrabajo()).toBe(desde);
  });

  it('ejecutar y concluir no exigen motivo', () => {
    const s = servicio();
    expect(() => s.cambiarEstadoTrabajo('EJECUTADO')).not.toThrow();
    expect(() => s.cambiarEstadoTrabajo('CONCLUIDO')).not.toThrow();
  });

  it('un servicio dado de baja (INACTIVO) no cambia de estado de trabajo', () => {
    const s = servicio('PROGRAMADO', 'INACTIVO');
    expect(() => s.cambiarEstadoTrabajo('EJECUTADO')).toThrow(/inactivo/i);
    expect(s.getEstadoTrabajo()).toBe('PROGRAMADO');
  });

  it('activar y desactivar no tocan el estado de trabajo', () => {
    const s = servicio('EJECUTADO');
    s.desactivar();
    s.activar();
    expect(s.getEstadoTrabajo()).toBe('EJECUTADO');
  });

  it('rechaza un estado de trabajo desconocido al reconstruir el servicio', () => {
    expect(() => servicio('ACTIVO' as EstadoTrabajo)).toThrow(/estado de trabajo no válido/i);
  });

  describe('estado visible (PENDIENTE derivado)', () => {
    const HOY = '2026-11-24';

    it('PROGRAMADO con la fecha programada vencida se ve PENDIENTE, sin cambiar el estado guardado', () => {
      const s = servicio('PROGRAMADO', 'ACTIVO', '2026-11-20');
      expect(s.getEstadoVisible(HOY)).toBe('PENDIENTE');
      expect(s.getEstadoTrabajo()).toBe('PROGRAMADO');
    });

    it('PROGRAMADO con fecha de hoy, futura o sin fecha sigue PROGRAMADO', () => {
      expect(servicio('PROGRAMADO', 'ACTIVO', HOY).getEstadoVisible(HOY)).toBe('PROGRAMADO');
      expect(servicio('PROGRAMADO', 'ACTIVO', '2026-12-01').getEstadoVisible(HOY)).toBe('PROGRAMADO');
      expect(servicio('PROGRAMADO').getEstadoVisible(HOY)).toBe('PROGRAMADO');
    });

    it.each<EstadoTrabajo>(['EJECUTADO', 'CONCLUIDO', 'CANCELADO'])('%s no se ve PENDIENTE aunque la fecha haya pasado', (estado) => {
      expect(servicio(estado, 'ACTIVO', '2020-01-01').getEstadoVisible(HOY)).toBe(estado);
    });

    it('expone la fecha programada', () => {
      expect(servicio('PROGRAMADO', 'ACTIVO', '2026-12-01').getFechaProgramada()).toBe('2026-12-01');
      expect(servicio().getFechaProgramada()).toBeNull();
    });

    it('al ejecutarse un servicio vencido deja de ser PENDIENTE', () => {
      const s = servicio('PROGRAMADO', 'ACTIVO', '2026-11-20');
      s.cambiarEstadoTrabajo('EJECUTADO');
      expect(s.getEstadoVisible(HOY)).toBe('EJECUTADO');
    });
  });
});
