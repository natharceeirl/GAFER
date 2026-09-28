import { describe, expect, it } from 'vitest';
import { EstadoCampoSchema, VisitaProgramadaSchema } from './visita';
import { esperarFallaEn } from './pruebas';

const visita = {
  id: '11111111-1111-1111-1111-111111111111',
  fecha: '2026-10-05',
  hora: '08:30',
  clienteId: '22222222-2222-2222-2222-222222222222',
  proyectoId: '33333333-3333-3333-3333-333333333333',
  servicioId: '44444444-4444-4444-4444-444444444444',
  tecnicoTitularId: null,
  observaciones: '',
  estadoCampo: 'PENDIENTE',
};

describe('VisitaProgramadaSchema (Spec §8.1, decisión C12)', () => {
  it('acepta una visita sin técnico titular', () => expect(VisitaProgramadaSchema.safeParse(visita).success).toBe(true));
  it('acepta una visita con técnico titular', () => {
    expect(VisitaProgramadaSchema.safeParse({ ...visita, tecnicoTitularId: '55555555-5555-5555-5555-555555555555' }).success).toBe(true);
  });
  it('rechaza fecha, hora y titular mal formados', () => {
    esperarFallaEn(VisitaProgramadaSchema, { ...visita, fecha: '05/10/2026' }, 'fecha');
    esperarFallaEn(VisitaProgramadaSchema, { ...visita, hora: '25:00' }, 'hora');
    esperarFallaEn(VisitaProgramadaSchema, { ...visita, tecnicoTitularId: 't1' }, 'tecnicoTitularId');
  });
  it('rechaza un estado de campo desconocido', () => esperarFallaEn(VisitaProgramadaSchema, { ...visita, estadoCampo: 'CERRADA' }, 'estadoCampo'));
});

describe('EstadoCampoSchema', () => {
  it('cubre los tres estados que llegan desde la app', () => {
    expect(EstadoCampoSchema.options).toEqual(['PENDIENTE', 'EN_CURSO', 'EN_REVISION']);
  });
});
