import { describe, expect, it } from 'vitest';
import { agendaDelDia, agregarVisita, tecnicosDisponibles, validarVisita, type DatosVisita, type VisitaProgramada } from './programacion';
import type { PersonalOperativo } from '../../mantenimiento/model/tipos';

const valida: DatosVisita = {
  clienteId: 'c1',
  proyectoId: 'p1',
  servicioId: 's-p1-drt',
  fecha: '2026-09-24',
  hora: '08:30',
  tecnicoTitularId: '',
  observaciones: '',
};

describe('validarVisita (§8.1)', () => {
  it('acepta una visita sin técnico titular: cualquier técnico puede atenderla (C12)', () => {
    expect(validarVisita(valida, '2026-09-23')).toEqual({});
  });

  it('exige cliente y sede, servicio, fecha y hora', () => {
    const e = validarVisita({ ...valida, proyectoId: '', servicioId: '', fecha: '', hora: '' }, '2026-09-23');
    expect(Object.keys(e).sort()).toEqual(['fecha', 'hora', 'proyectoId', 'servicioId']);
  });

  it('no deja programar en una fecha pasada', () => {
    expect(validarVisita({ ...valida, fecha: '2026-09-22' }, '2026-09-23').fecha).toBeDefined();
    expect(validarVisita({ ...valida, fecha: '2026-09-23' }, '2026-09-23').fecha).toBeUndefined();
  });
});

const visitas: VisitaProgramada[] = [
  { id: 'v1', fecha: '2026-09-23', hora: '15:00', clienteId: 'c1', proyectoId: 'p1', servicioId: 's1', tecnicoTitularId: null, observaciones: '', estadoCampo: 'PENDIENTE' },
  { id: 'v2', fecha: '2026-09-23', hora: '08:00', clienteId: 'c1', proyectoId: 'p1', servicioId: 's2', tecnicoTitularId: 'p2', observaciones: '', estadoCampo: 'EN_REVISION' },
  { id: 'v3', fecha: '2026-09-24', hora: '09:00', clienteId: 'c2', proyectoId: 'p2', servicioId: 's3', tecnicoTitularId: null, observaciones: '', estadoCampo: 'PENDIENTE' },
];

describe('agendaDelDia', () => {
  it('devuelve solo las visitas de esa fecha, ordenadas por hora', () => {
    expect(agendaDelDia(visitas, '2026-09-23').map((v) => v.id)).toEqual(['v2', 'v1']);
  });
});

describe('agregarVisita', () => {
  it('agrega la visita pendiente y sin titular si no se eligió uno', () => {
    const nuevas = agregarVisita(visitas, valida);
    const agregada = nuevas.at(-1);
    expect(nuevas).toHaveLength(4);
    expect(agregada).toMatchObject({ fecha: '2026-09-24', hora: '08:30', tecnicoTitularId: null, estadoCampo: 'PENDIENTE' });
  });
});

describe('tecnicosDisponibles', () => {
  it('ofrece como titular solo técnicos operadores activos', () => {
    const personal: PersonalOperativo[] = [
      { id: 'p1', nombre: 'Diana Amamani', dni: '1', cargo: 'Supervisor', estado: 'ACTIVO' },
      { id: 'p2', nombre: 'Marco Ipusari', dni: '2', cargo: 'Técnico Operador', estado: 'ACTIVO' },
      { id: 'p5', nombre: 'Luis Beltrán', dni: '3', cargo: 'Técnico Operador', estado: 'INACTIVO' },
    ];
    expect(tecnicosDisponibles(personal).map((p) => p.id)).toEqual(['p2']);
  });
});
