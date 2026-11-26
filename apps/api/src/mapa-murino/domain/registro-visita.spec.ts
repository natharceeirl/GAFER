import type { EstacionVisitaEntrada } from '@gafer/contracts';
import { estadoDelMapa } from './mapa';
import { claveDeOrden, construirEventos, LimiteMapaExcedidoError, ReglaMapaError } from './registro-visita';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const PLANO = 'plano-1';

const inspeccion = (huboConsumo: boolean) => ({
  tipoCebo: 'Bloque',
  cantidadGramos: 20,
  lote: 'L-1',
  vencimiento: '2027-01-01',
  huboConsumo,
});
const nueva = (estacionId: string, numero: number, extra: Partial<EstacionVisitaEntrada> = {}): EstacionVisitaEntrada => ({
  estacionId,
  numero,
  tipoEstacion: 'CEBO_RATICIDA',
  posicion: { x: 10 * numero, y: 10 },
  instalada: true,
  reubicada: false,
  inspeccion: null,
  ...extra,
});
const insp = (estacionId: string, numero: number, consumo: boolean, extra: Partial<EstacionVisitaEntrada> = {}) =>
  nueva(estacionId, numero, { instalada: false, inspeccion: inspeccion(consumo), ...extra });

const primeraVisita = () => ({ id: 'v1', fecha: '2026-01-01', tecnico: '', eventos: construirEventos(PLANO, '2026-01-01', [], [nueva(A, 1)]) });
const previoTrasPrimera = () => estadoDelMapa([primeraVisita()], 0);

describe('construirEventos', () => {
  it('la primera visita instala estaciones sin inspección ni origen', () => {
    const [ev] = construirEventos(PLANO, '2026-01-01', [], [nueva(A, 1)]);
    expect(ev).toMatchObject({ estacionId: A, planoId: PLANO, instalada: true, inspeccion: null, reubicadaDesde: null, posicion: { x: 10, y: 10 } });
  });

  it('una estación nueva en una visita posterior se instala sin evaluarse y empieza a evaluarse la siguiente', () => {
    const previo = previoTrasPrimera();
    const eventos = construirEventos(PLANO, '2026-01-01', previo, [insp(A, 1, true), nueva(B, 2)]);
    const visitas = [primeraVisita(), { id: 'v2', fecha: '2026-01-02', tecnico: '', eventos }];
    const enV2 = estadoDelMapa(visitas, 1).find((e) => e.estacion.id === B)!;
    expect(enV2.estacion.colorAura).toBe('SIN_COLOR');
    expect(enV2.instaladaEnVisita).toBe(true);
    const v3 = { id: 'v3', fecha: '2026-01-03', tecnico: '', eventos: construirEventos(PLANO, '2026-01-01', estadoDelMapa(visitas, 1), [insp(A, 1, true), insp(B, 2, true)]) };
    expect(estadoDelMapa([...visitas, v3], 2).find((e) => e.estacion.id === B)!.estacion.colorAura).toBe('VERDE');
  });

  it('una reubicación guarda de dónde vino y la nueva posición (decisión A)', () => {
    const [ev] = construirEventos(PLANO, '2026-01-01', previoTrasPrimera(), [insp(A, 1, true, { reubicada: true, posicion: { x: 99, y: 88 } })]);
    expect(ev).toMatchObject({ posicion: { x: 99, y: 88 }, reubicadaDesde: { x: 10, y: 10 }, instalada: false });
  });

  it('una estación que no figura en la visita se considera retirada', () => {
    const previo = estadoDelMapa(
      [{ id: 'v1', fecha: '2026-01-01', tecnico: '', eventos: construirEventos(PLANO, '2026-01-01', [], [nueva(A, 1), nueva(B, 2)]) }],
      0,
    );
    const eventos = construirEventos(PLANO, '2026-01-01', previo, [insp(A, 1, false)]);
    expect(eventos.map((e) => e.estacionId)).toEqual([A]);
  });

  it('rechaza estaciones repetidas por id o por número', () => {
    expect(() => construirEventos(PLANO, '2026-01-01', [], [nueva(A, 1), nueva(A, 2)])).toThrow(ReglaMapaError);
    expect(() => construirEventos(PLANO, '2026-01-01', [], [nueva(A, 1), nueva(B, 1)])).toThrow('número');
  });

  it('rechaza una instalación con inspección o con reubicación', () => {
    expect(() => construirEventos(PLANO, '2026-01-01', [], [nueva(A, 1, { inspeccion: inspeccion(true) })])).toThrow('no se inspecciona');
    expect(() => construirEventos(PLANO, '2026-01-01', [], [nueva(A, 1, { reubicada: true })])).toThrow('reubic');
  });

  it('rechaza instalar una estación que ya está en el plano', () => {
    expect(() => construirEventos(PLANO, '2026-01-01', previoTrasPrimera(), [nueva(A, 1)])).toThrow('ya está instalada');
  });

  it('rechaza inspeccionar una estación que no está en el plano, o sin registrar la inspección', () => {
    expect(() => construirEventos(PLANO, '2026-01-01', [], [insp(A, 1, true)])).toThrow('no está instalada');
    expect(() => construirEventos(PLANO, '2026-01-01', previoTrasPrimera(), [nueva(A, 1, { instalada: false })])).toThrow('debe registrar la inspección');
  });

  it('rechaza cambiar el número o el tipo de una estación ya instalada', () => {
    expect(() => construirEventos(PLANO, '2026-01-01', previoTrasPrimera(), [insp(A, 5, true)])).toThrow('número');
    expect(() => construirEventos(PLANO, '2026-01-01', previoTrasPrimera(), [insp(A, 1, true, { tipoEstacion: 'TRAMPA_MECANICA' })])).toThrow('tipo');
  });

  it('rechaza cambiar la posición sin marcar la reubicación, y marcarla sin moverla', () => {
    expect(() => construirEventos(PLANO, '2026-01-01', previoTrasPrimera(), [insp(A, 1, true, { posicion: { x: 1, y: 1 } })])).toThrow('reubicada');
    expect(() => construirEventos(PLANO, '2026-01-01', previoTrasPrimera(), [insp(A, 1, true, { reubicada: true })])).toThrow('misma posición');
  });

  it('una visita sin estaciones no se registra', () => {
    expect(() => construirEventos(PLANO, '2026-01-01', [], [])).toThrow('al menos una estación');
  });

  it('no admite más de 100 estaciones en un plano', () => {
    const ciento1 = Array.from({ length: 101 }, (_, i) => nueva(`${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`, (i % 100) + 1));
    expect(() => construirEventos(PLANO, '2026-01-01', [], ciento1)).toThrow(LimiteMapaExcedidoError);
    const cien = Array.from({ length: 100 }, (_, i) => nueva(`${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`, i + 1));
    expect(construirEventos(PLANO, '2026-01-01', [], cien)).toHaveLength(100);
  });
});

describe('claveDeOrden', () => {
  it('ordena por fecha, luego hora y luego id', () => {
    const claves = [
      claveDeOrden('2026-01-02', '08:00', 'a'),
      claveDeOrden('2026-01-01', '23:59', 'z'),
      claveDeOrden('2026-01-02', '07:30', 'b'),
      claveDeOrden('2026-01-02', '08:00', '0'),
    ];
    expect([...claves].sort()).toEqual([claves[1], claves[2], claves[3], claves[0]]);
  });
});
