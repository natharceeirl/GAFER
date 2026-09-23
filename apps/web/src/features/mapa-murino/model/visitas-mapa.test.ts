import { describe, expect, it } from 'vitest';
import { estadoDelMapa, resumenDelMapa, siguienteAura, type EventoEstacion, type VisitaMapa } from './visitas-mapa';
import type { InspeccionRegistrada } from './aura';

function insp(consumo: boolean): InspeccionRegistrada {
  return {
    fecha: '',
    tipoCebo: 'Bloque',
    cantidadGramos: 20,
    lote: 'L-1',
    vencimiento: '2027-01-01',
    huboConsumo: consumo,
    porcentajeConsumo: consumo ? 50 : undefined,
    estadoFisico: consumo ? undefined : 'BUENAS_CONDICIONES',
  };
}

const base = { numero: 1, planoId: 'pb', tipoEstacion: 'CEBO_RATICIDA' as const, posicion: { x: 10, y: 10 }, reubicadaDesde: null };
const instalada = (estacionId: string, extra: Partial<EventoEstacion> = {}): EventoEstacion => ({
  ...base,
  estacionId,
  instalada: true,
  inspeccion: null,
  ...extra,
});
const inspeccionada = (estacionId: string, consumo: boolean, extra: Partial<EventoEstacion> = {}): EventoEstacion => ({
  ...base,
  estacionId,
  instalada: false,
  inspeccion: insp(consumo),
  ...extra,
});
const visita = (n: number, eventos: EventoEstacion[]): VisitaMapa => ({ id: `v${n}`, fecha: `2026-01-${String(n).padStart(2, '0')}`, tecnico: 'T', eventos });

describe('siguienteAura (§5.3): sube o baja exactamente un nivel por visita', () => {
  it('sube con consumo y se topa en ROJO', () => {
    expect(siguienteAura('SIN_COLOR', true)).toBe('VERDE');
    expect(siguienteAura('VERDE', true)).toBe('AMARILLO');
    expect(siguienteAura('NARANJA', true)).toBe('ROJO');
    expect(siguienteAura('ROJO', true)).toBe('ROJO');
  });
  it('baja sin consumo y desaparece desde VERDE', () => {
    expect(siguienteAura('ROJO', false)).toBe('NARANJA');
    expect(siguienteAura('VERDE', false)).toBe('SIN_COLOR');
    expect(siguienteAura('SIN_COLOR', false)).toBe('SIN_COLOR');
  });
});

describe('estadoDelMapa', () => {
  it('la visita de instalación deja el ícono VERDE y sin aura (§5.1)', () => {
    const [e] = estadoDelMapa([visita(1, [instalada('a')])], 0);
    expect(e.estacion).toMatchObject({ colorIcono: 'VERDE', colorAura: 'SIN_COLOR' });
    expect(e.instaladaEnVisita).toBe(true);
    expect(e.historial).toEqual([]);
  });

  it('el aura se calcula desde la segunda visita, cuando el técnico valida el consumo', () => {
    const visitas = [visita(1, [instalada('a')]), visita(2, [inspeccionada('a', true)]), visita(3, [inspeccionada('a', true)])];
    expect(estadoDelMapa(visitas, 1)[0].estacion).toMatchObject({ colorIcono: 'ROJO', colorAura: 'VERDE' });
    expect(estadoDelMapa(visitas, 2)[0].estacion).toMatchObject({ colorIcono: 'ROJO', colorAura: 'AMARILLO' });
    expect(estadoDelMapa(visitas, 2)[0].consumosSeguidos).toBe(2);
  });

  it('ícono y aura son capas independientes', () => {
    const visitas = [
      visita(1, [instalada('a')]),
      visita(2, [inspeccionada('a', true)]),
      visita(3, [inspeccionada('a', true)]),
      visita(4, [inspeccionada('a', false)]),
    ];
    expect(estadoDelMapa(visitas, 3)[0].estacion).toMatchObject({ colorIcono: 'VERDE', colorAura: 'VERDE' });
    expect(estadoDelMapa(visitas, 3)[0].consumosSeguidos).toBe(0);
  });

  it('una estación reubicada conserva su aura y toma la nueva posición (decisión A)', () => {
    const visitas = [
      visita(1, [instalada('a')]),
      visita(2, [inspeccionada('a', true)]),
      visita(3, [inspeccionada('a', true, { posicion: { x: 50, y: 60 }, reubicadaDesde: { x: 10, y: 10 } })]),
    ];
    const [e] = estadoDelMapa(visitas, 2);
    expect(e.estacion.colorAura).toBe('AMARILLO');
    expect(e.posicion).toEqual({ x: 50, y: 60 });
    expect(e.reubicadaDesde).toEqual({ x: 10, y: 10 });
    expect(e.reubicaciones).toEqual(['2026-01-03']);
  });

  it('una estación agregada en una visita posterior empieza sin aura y suma desde la siguiente', () => {
    const visitas = [
      visita(1, [instalada('a')]),
      visita(2, [inspeccionada('a', true), instalada('b', { numero: 2 })]),
      visita(3, [inspeccionada('a', true), inspeccionada('b', true, { numero: 2 })]),
    ];
    const enV2 = estadoDelMapa(visitas, 1).find((e) => e.estacion.id === 'b')!;
    expect(enV2.estacion.colorAura).toBe('SIN_COLOR');
    expect(enV2.instaladaEnVisita).toBe(true);
    expect(estadoDelMapa(visitas, 2).find((e) => e.estacion.id === 'b')!.estacion.colorAura).toBe('VERDE');
  });

  it('una estación que no figura en la visita se considera retirada', () => {
    const visitas = [visita(1, [instalada('a'), instalada('b', { numero: 2 })]), visita(2, [inspeccionada('a', false)])];
    expect(estadoDelMapa(visitas, 1).map((e) => e.estacion.id)).toEqual(['a']);
  });

  it('no mira visitas posteriores a la elegida', () => {
    const visitas = [visita(1, [instalada('a')]), visita(2, [inspeccionada('a', true)])];
    expect(estadoDelMapa(visitas, 0)[0].estacion.colorIcono).toBe('VERDE');
  });
});

describe('resumenDelMapa (§5.5): tabla bajo el mapa', () => {
  it('cuenta formas, colores de ícono y de aura, y el período de las últimas 4 visitas', () => {
    const visitas = [
      visita(1, [instalada('a'), instalada('b', { numero: 2, tipoEstacion: 'TRAMPA_MECANICA' })]),
      visita(2, [inspeccionada('a', true), inspeccionada('b', false, { numero: 2, tipoEstacion: 'TRAMPA_MECANICA' })]),
      visita(3, [inspeccionada('a', true), inspeccionada('b', false, { numero: 2, tipoEstacion: 'TRAMPA_MECANICA' })]),
      visita(4, [inspeccionada('a', true), inspeccionada('b', false, { numero: 2, tipoEstacion: 'TRAMPA_MECANICA' })]),
      visita(5, [inspeccionada('a', true), inspeccionada('b', false, { numero: 2, tipoEstacion: 'TRAMPA_MECANICA' })]),
    ];
    expect(resumenDelMapa(estadoDelMapa(visitas, 4), visitas, 4)).toEqual({
      estaciones: 2,
      circulos: 1,
      cuadrados: 1,
      icono: { VERDE: 1, ROJO: 1 },
      aura: { SIN_COLOR: 1, VERDE: 0, AMARILLO: 0, NARANJA: 0, ROJO: 1 },
      desde: '2026-01-02',
      hasta: '2026-01-05',
    });
  });
});
