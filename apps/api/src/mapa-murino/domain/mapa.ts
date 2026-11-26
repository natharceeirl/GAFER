import { LIMITES_MAPA } from '@gafer/contracts';
import type { ColorAura, ColorIcono, Estacion as EstacionContrato, InspeccionRegistrada, Punto, TipoEstacion } from '@gafer/contracts';

export { LIMITES_MAPA };
export type { Punto };

/**
 * Lógica pura del Mapa Murino (spec §5.3 a §5.5): sin acceso a datos ni framework.
 * Es el mismo modelo que valida el prototipo web (`visitas-mapa.ts`), ahora del lado del servidor.
 */

/** Niveles del aura en orden: sin color y los 4 niveles visibles. */
export const NIVELES_AURA: readonly ColorAura[] = ['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO'];

/**
 * Lo que el técnico registra de una estación en una visita. La visita en que se instala no evalúa
 * consumo (`inspeccion: null`); desde la siguiente, cada visita la inspecciona. Si la reubica, la
 * inspección se hizo en el lugar anterior y `posicion` es donde queda (decisión A: conserva su aura).
 */
export interface EventoEstacion {
  estacionId: string;
  numero: number;
  planoId: string;
  tipoEstacion: TipoEstacion;
  posicion: Punto;
  instalada: boolean;
  reubicadaDesde: Punto | null;
  inspeccion: InspeccionRegistrada | null;
}

export interface VisitaMapa {
  id: string;
  fecha: string;
  tecnico: string;
  eventos: EventoEstacion[];
}

export interface EstacionEnMapa {
  estacion: EstacionContrato;
  planoId: string;
  posicion: Punto;
  /** Solo si se reubicó en la visita que se está mirando. */
  reubicadaDesde: Punto | null;
  instaladaEnVisita: boolean;
  /** Fechas en que se reubicó, hasta la visita que se está mirando. */
  reubicaciones: string[];
  historial: InspeccionRegistrada[];
  consumosSeguidos: number;
}

/** Regla fundamental del aura (§5.3): un nivel por visita, hacia arriba con consumo y hacia abajo sin él. */
export function siguienteAura(actual: ColorAura, huboConsumo: boolean): ColorAura {
  const i = NIVELES_AURA.indexOf(actual);
  return NIVELES_AURA[Math.min(NIVELES_AURA.length - 1, Math.max(0, i + (huboConsumo ? 1 : -1)))];
}

/** El ícono refleja solo la última inspección; no acumula. */
export function colorIconoDe(huboConsumo: boolean): ColorIcono {
  return huboConsumo ? 'ROJO' : 'VERDE';
}

/**
 * Estado de cada estación tal como quedó al cierre de la visita `indice`. Solo mira las visitas
 * hasta esa, así que reconstruir una visita pasada da siempre el mismo resultado.
 * Una estación que no figura en una visita se considera retirada.
 */
export function estadoDelMapa(visitas: readonly VisitaMapa[], indice: number): EstacionEnMapa[] {
  if (!Number.isInteger(indice) || indice < 0 || indice >= visitas.length) {
    throw new RangeError('Visita fuera de rango');
  }
  const estado = new Map<string, EstacionEnMapa>();

  visitas.slice(0, indice + 1).forEach((visita, i) => {
    const esLaMirada = i === indice;
    const presentes = new Set(visita.eventos.map((e) => e.estacionId));
    for (const id of [...estado.keys()]) if (!presentes.has(id)) estado.delete(id);

    for (const ev of visita.eventos) {
      const previa = estado.get(ev.estacionId);
      // La visita en que se instala (o la primera en que aparece) no evalúa consumo: el aura arranca sin color.
      const nueva = ev.instalada || !previa;
      const aura = nueva || !ev.inspeccion ? 'SIN_COLOR' : siguienteAura(previa.estacion.colorAura, ev.inspeccion.huboConsumo);
      const consumo = !nueva && ev.inspeccion?.huboConsumo === true;
      const historial = nueva || !ev.inspeccion ? [] : [...previa.historial, { ...ev.inspeccion, fecha: visita.fecha }];
      estado.set(ev.estacionId, {
        estacion: {
          id: ev.estacionId,
          numero: ev.numero,
          tipoEstacion: ev.tipoEstacion,
          colorIcono: colorIconoDe(consumo),
          colorAura: aura,
        },
        planoId: ev.planoId,
        posicion: ev.posicion,
        reubicadaDesde: esLaMirada ? ev.reubicadaDesde : null,
        instaladaEnVisita: esLaMirada && nueva,
        reubicaciones: [...(nueva ? [] : previa.reubicaciones), ...(ev.reubicadaDesde ? [visita.fecha] : [])],
        historial,
        consumosSeguidos: consumo ? (previa?.consumosSeguidos ?? 0) + 1 : 0,
      });
    }
  });

  return [...estado.values()];
}

/** Tabla resumen bajo el mapa (§5.5). El período es el de la data del aura: las últimas 4 visitas hasta la mirada. */
export function resumenDelMapa(estaciones: readonly EstacionEnMapa[], visitas: readonly VisitaMapa[], indice: number) {
  const contar = <K extends string>(claves: readonly K[], de: (e: EstacionEnMapa) => K) =>
    claves.reduce((acc, k) => ({ ...acc, [k]: estaciones.filter((e) => de(e) === k).length }), {} as Record<K, number>);
  return {
    estaciones: estaciones.length,
    circulos: estaciones.filter((e) => e.estacion.tipoEstacion === 'CEBO_RATICIDA').length,
    cuadrados: estaciones.filter((e) => e.estacion.tipoEstacion !== 'CEBO_RATICIDA').length,
    icono: contar(['VERDE', 'ROJO'] as const, (e) => e.estacion.colorIcono),
    aura: contar(NIVELES_AURA, (e) => e.estacion.colorAura),
    desde: visitas[Math.max(0, indice - 3)].fecha,
    hasta: visitas[indice].fecha,
  };
}

/** Radio del halo irradiado por el aura de cada estación, en unidades del plano (igual que el prototipo). */
export const RADIO_IRRADIACION = 100;

/**
 * Intensidad del halo según el nivel de aura: a mayor severidad, mayor opacidad (§5.4).
 * SIN_COLOR no irradia.
 */
export function intensidadDeAura(aura: ColorAura): number {
  switch (aura) {
    case 'VERDE':
      return 0.16;
    case 'AMARILLO':
      return 0.22;
    case 'NARANJA':
      return 0.3;
    case 'ROJO':
      return 0.4;
    default:
      return 0;
  }
}

export interface Irradiacion {
  estacionId: string;
  planoId: string;
  posicion: Punto;
  colorAura: ColorAura;
  radio: number;
  intensidad: number;
}

/** Halos de las estaciones con aura activa. Una estación sin aura no aporta nada. */
export function irradiacionDelMapa(estaciones: readonly EstacionEnMapa[]): Irradiacion[] {
  return estaciones
    .filter((e) => e.estacion.colorAura !== 'SIN_COLOR')
    .map((e) => ({
      estacionId: e.estacion.id,
      planoId: e.planoId,
      posicion: e.posicion,
      colorAura: e.estacion.colorAura,
      radio: RADIO_IRRADIACION,
      intensidad: intensidadDeAura(e.estacion.colorAura),
    }));
}

/**
 * Intensidad acumulada en un punto del plano. Cada halo se desvanece linealmente con la distancia y
 * donde dos se superponen el color se intensifica (el área ENTRE estaciones cercanas también se colorea),
 * sin pasar de 1.
 */
export function intensidadEnPunto(irradiaciones: readonly Irradiacion[], punto: Punto): number {
  const total = irradiaciones.reduce((suma, h) => {
    const distancia = Math.hypot(punto.x - h.posicion.x, punto.y - h.posicion.y);
    return distancia >= h.radio ? suma : suma + h.intensidad * (1 - distancia / h.radio);
  }, 0);
  return Math.min(1, total);
}
