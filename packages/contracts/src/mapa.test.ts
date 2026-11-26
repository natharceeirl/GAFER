import { describe, expect, it } from 'vitest';
import { CrearPlanoSchema, LIMITES_MAPA, RegistrarVisitaMapaSchema } from './mapa';

const estacion = {
  estacionId: '11111111-1111-4111-8111-111111111111',
  numero: 1,
  tipoEstacion: 'CEBO_RATICIDA',
  posicion: { x: 10, y: 20 },
  instalada: true,
  reubicada: false,
  inspeccion: null,
} as const;

const inspeccion = {
  tipoCebo: 'Bloque',
  cantidadGramos: 20,
  lote: 'L-1',
  vencimiento: '2027-01-01',
  huboConsumo: false,
  estadoFisico: 'BUENAS_CONDICIONES',
} as const;

describe('LIMITES_MAPA', () => {
  it('fija 20 planos por proyecto y 100 estaciones por plano (§5.1)', () => {
    expect(LIMITES_MAPA).toEqual({ planosPorProyecto: 20, estacionesPorPlano: 100 });
  });
});

describe('CrearPlanoSchema', () => {
  it('acepta un plano con nombre y terreno', () => {
    const r = CrearPlanoSchema.safeParse({ nombre: 'Planta baja', puntos: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], cerrado: true });
    expect(r.success).toBe(true);
  });

  it('rechaza un nombre vacío o un punto que no es número finito', () => {
    expect(CrearPlanoSchema.safeParse({ nombre: '  ', puntos: [], cerrado: false }).success).toBe(false);
    expect(CrearPlanoSchema.safeParse({ nombre: 'A', puntos: [{ x: Infinity, y: 0 }], cerrado: false }).success).toBe(false);
  });
});

describe('RegistrarVisitaMapaSchema', () => {
  it('acepta la visita de instalación sin inspección', () => {
    expect(RegistrarVisitaMapaSchema.safeParse({ estaciones: [estacion] }).success).toBe(true);
  });

  it('exige reubicada e instalada como booleanos con valor por defecto falso', () => {
    const { instalada: _i, reubicada: _r, ...resto } = estacion;
    const r = RegistrarVisitaMapaSchema.parse({ estaciones: [{ ...resto, inspeccion }] });
    expect(r.estaciones[0]).toMatchObject({ instalada: false, reubicada: false });
  });

  it('no admite más de 100 estaciones por plano', () => {
    const muchas = Array.from({ length: 101 }, (_, i) => ({ ...estacion, estacionId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`, numero: i + 1 }));
    const r = RegistrarVisitaMapaSchema.safeParse({ estaciones: muchas });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('100');
  });

  it('rechaza un número de estación fuera de 1 a 100 y un tipo desconocido', () => {
    expect(RegistrarVisitaMapaSchema.safeParse({ estaciones: [{ ...estacion, numero: 0 }] }).success).toBe(false);
    expect(RegistrarVisitaMapaSchema.safeParse({ estaciones: [{ ...estacion, numero: 101 }] }).success).toBe(false);
    expect(RegistrarVisitaMapaSchema.safeParse({ estaciones: [{ ...estacion, tipoEstacion: 'JAULA' }] }).success).toBe(false);
  });

  it('la inspección no lleva fecha: la pone el servidor con la de la visita', () => {
    const r = RegistrarVisitaMapaSchema.parse({ estaciones: [{ ...estacion, instalada: false, inspeccion: { ...inspeccion, fecha: '2020-01-01' } }] });
    expect(r.estaciones[0].inspeccion).not.toHaveProperty('fecha');
  });
});
