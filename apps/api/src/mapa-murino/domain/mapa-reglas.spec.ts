import type { InspeccionRegistrada } from '@gafer/contracts';
import {
  estadoDelMapa,
  intensidadDeAura,
  irradiacionDelMapa,
  intensidadEnPunto,
  RADIO_IRRADIACION,
  type EventoEstacion,
  type VisitaMapa,
} from './mapa';

const insp = (huboConsumo: boolean): InspeccionRegistrada => ({
  fecha: '2026-01-01',
  tipoCebo: 'Bloque',
  cantidadGramos: 20,
  lote: 'L-1',
  vencimiento: '2027-01-01',
  huboConsumo,
});
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
const visita = (n: number, eventos: EventoEstacion[]): VisitaMapa => ({
  id: `v${n}`,
  fecha: `2026-01-${String(n).padStart(2, '0')}`,
  tecnico: 'T',
  eventos,
});

const NIVELES = ['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO'];

describe('estadoDelMapa: reglas adicionales de §5.3', () => {
  it('ROJO es el tope: con consumo sostenido el aura sube un nivel por visita y se queda en ROJO', () => {
    const visitas = [visita(1, [instalada('a')])];
    for (let n = 2; n <= 8; n += 1) visitas.push(visita(n, [inspeccionada('a', true)]));
    const auras = visitas.map((_, i) => estadoDelMapa(visitas, i)[0].estacion.colorAura);
    expect(auras).toEqual(['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO', 'ROJO', 'ROJO', 'ROJO']);
  });

  it('nunca salta más de un nivel entre visitas consecutivas, con cualquier secuencia', () => {
    const secuencia = [true, true, false, true, true, true, true, false, false, false, false, false, true];
    const visitas = [visita(1, [instalada('a')])];
    secuencia.forEach((c, i) => visitas.push(visita(i + 2, [inspeccionada('a', c)])));
    let anterior = 0;
    for (let i = 0; i < visitas.length; i += 1) {
      const actual = NIVELES.indexOf(estadoDelMapa(visitas, i)[0].estacion.colorAura);
      expect(Math.abs(actual - anterior)).toBeLessThanOrEqual(1);
      anterior = actual;
    }
  });

  it('el ícono refleja solo la última inspección, aunque el aura venga alta', () => {
    const visitas = [
      visita(1, [instalada('a')]),
      ...[true, true, true, true].map((c, i) => visita(i + 2, [inspeccionada('a', c)])),
      visita(6, [inspeccionada('a', false)]),
    ];
    expect(estadoDelMapa(visitas, 4)[0].estacion).toMatchObject({ colorIcono: 'ROJO', colorAura: 'ROJO' });
    expect(estadoDelMapa(visitas, 5)[0].estacion).toMatchObject({ colorIcono: 'VERDE', colorAura: 'NARANJA' });
  });

  it('acumula el historial con la fecha de cada visita', () => {
    const visitas = [visita(1, [instalada('a')]), visita(2, [inspeccionada('a', true)]), visita(3, [inspeccionada('a', false)])];
    const [e] = estadoDelMapa(visitas, 2);
    expect(e.historial.map((h) => [h.fecha, h.huboConsumo])).toEqual([
      ['2026-01-02', true],
      ['2026-01-03', false],
    ]);
    expect(e.consumosSeguidos).toBe(0);
  });

  it('la marca de reubicación solo aparece en la visita en que ocurrió y el aura se conserva', () => {
    const visitas = [
      visita(1, [instalada('a')]),
      visita(2, [inspeccionada('a', true, { posicion: { x: 5, y: 5 }, reubicadaDesde: { x: 10, y: 10 } })]),
      visita(3, [inspeccionada('a', true, { posicion: { x: 5, y: 5 } })]),
    ];
    expect(estadoDelMapa(visitas, 1)[0].reubicadaDesde).toEqual({ x: 10, y: 10 });
    const [despues] = estadoDelMapa(visitas, 2);
    expect(despues.reubicadaDesde).toBeNull();
    expect(despues.reubicaciones).toEqual(['2026-01-02']);
    expect(despues.estacion.colorAura).toBe('AMARILLO');
  });

  it('una estación reinstalada vuelve a empezar sin aura', () => {
    const visitas = [visita(1, [instalada('a')]), visita(2, [inspeccionada('a', true)]), visita(3, [instalada('a')])];
    const [e] = estadoDelMapa(visitas, 2);
    expect(e.estacion.colorAura).toBe('SIN_COLOR');
    expect(e.instaladaEnVisita).toBe(true);
  });

  it('rechaza una visita fuera de rango', () => {
    expect(() => estadoDelMapa([visita(1, [instalada('a')])], 3)).toThrow('Visita fuera de rango');
    expect(() => estadoDelMapa([], 0)).toThrow('Visita fuera de rango');
    expect(() => estadoDelMapa([visita(1, [instalada('a')])], -1)).toThrow('Visita fuera de rango');
  });

  it('no muta las visitas y reconstruir una visita pasada da siempre lo mismo', () => {
    const visitas = [visita(1, [instalada('a')]), visita(2, [inspeccionada('a', true)]), visita(3, [inspeccionada('a', true)])];
    const copia = structuredClone(visitas);
    const primera = estadoDelMapa(visitas, 1);
    estadoDelMapa(visitas, 2);
    expect(estadoDelMapa(visitas, 1)).toEqual(primera);
    expect(visitas).toEqual(copia);
  });
});

describe('irradiación del aura (§5.4)', () => {
  const dosVisitas = (consumoA: boolean[]) => {
    const visitas = [visita(1, [instalada('a'), instalada('b', { numero: 2, posicion: { x: 60, y: 10 } })])];
    consumoA.forEach((c, i) =>
      visitas.push(visita(i + 2, [inspeccionada('a', c), inspeccionada('b', false, { numero: 2, posicion: { x: 60, y: 10 } })])),
    );
    return visitas;
  };

  it('la intensidad crece con el nivel y SIN_COLOR no irradia', () => {
    expect(intensidadDeAura('SIN_COLOR')).toBe(0);
    const valores = (['VERDE', 'AMARILLO', 'NARANJA', 'ROJO'] as const).map(intensidadDeAura);
    expect(valores).toEqual([0.16, 0.22, 0.3, 0.4]);
  });

  it('solo las estaciones con aura irradian, con el radio fijo del mapa', () => {
    const visitas = dosVisitas([true, true]);
    const irradiaciones = irradiacionDelMapa(estadoDelMapa(visitas, 2));
    expect(irradiaciones).toEqual([
      { estacionId: 'a', planoId: 'pb', posicion: { x: 10, y: 10 }, colorAura: 'AMARILLO', radio: RADIO_IRRADIACION, intensidad: 0.22 },
    ]);
  });

  it('entre dos estaciones cercanas el área también se colorea y los halos superpuestos se intensifican', () => {
    const visitas = [
      visita(1, [instalada('a'), instalada('b', { numero: 2, posicion: { x: 60, y: 10 } })]),
      visita(2, [inspeccionada('a', true), inspeccionada('b', true, { numero: 2, posicion: { x: 60, y: 10 } })]),
    ];
    const irradiaciones = irradiacionDelMapa(estadoDelMapa(visitas, 1));
    const solo = intensidadEnPunto(irradiaciones.slice(0, 1), { x: 35, y: 10 });
    const ambas = intensidadEnPunto(irradiaciones, { x: 35, y: 10 });
    expect(solo).toBeGreaterThan(0);
    expect(ambas).toBeGreaterThan(solo);
    expect(ambas).toBeLessThanOrEqual(1);
  });

  it('fuera del radio no hay irradiación y en el centro es la intensidad del nivel', () => {
    const visitas = [visita(1, [instalada('a')]), visita(2, [inspeccionada('a', true)])];
    const irradiaciones = irradiacionDelMapa(estadoDelMapa(visitas, 1));
    expect(intensidadEnPunto(irradiaciones, { x: 10 + RADIO_IRRADIACION + 1, y: 10 })).toBe(0);
    expect(intensidadEnPunto(irradiaciones, { x: 10, y: 10 })).toBeCloseTo(0.16);
  });
});
