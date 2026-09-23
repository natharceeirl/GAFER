import type { ColorAura, Estacion, TipoEstacion } from '@gafer/contracts';
import type { InspeccionRegistrada, Punto } from './aura';

/** Capacidad del mapa (§5.1). */
export const LIMITES_MAPA = { planosPorProyecto: 20, estacionesPorPlano: 100 } as const;

/**
 * Lo que el técnico registra de una estación en una visita. La visita en
 * que se instala no evalúa consumo (`inspeccion: null`); desde la
 * siguiente, cada visita la inspecciona. Si la reubica, la inspección se
 * hizo en el lugar anterior y `posicion` es donde queda (decisión A: la
 * estación conserva su aura al moverse).
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
  estacion: Estacion;
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

const NIVELES: ColorAura[] = ['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO'];

/** Regla fundamental del aura (§5.3): un nivel por visita, hacia arriba con consumo y hacia abajo sin él. */
export function siguienteAura(actual: ColorAura, huboConsumo: boolean): ColorAura {
  const i = NIVELES.indexOf(actual);
  return NIVELES[Math.min(NIVELES.length - 1, Math.max(0, i + (huboConsumo ? 1 : -1)))];
}

/** Estado de cada estación tal como quedó al cierre de la visita `indice`. */
export function estadoDelMapa(visitas: VisitaMapa[], indice: number): EstacionEnMapa[] {
  const estado = new Map<string, EstacionEnMapa>();

  visitas.slice(0, indice + 1).forEach((visita, i) => {
    const esLaMirada = i === indice;
    const presentes = new Set(visita.eventos.map((e) => e.estacionId));
    for (const id of [...estado.keys()]) if (!presentes.has(id)) estado.delete(id);

    for (const ev of visita.eventos) {
      const previa = estado.get(ev.estacionId);
      const nueva = ev.instalada || !previa;
      const aura = nueva || !ev.inspeccion ? 'SIN_COLOR' : siguienteAura(previa.estacion.colorAura, ev.inspeccion.huboConsumo);
      const consumo = !nueva && ev.inspeccion?.huboConsumo === true;
      const historial = nueva || !ev.inspeccion ? [] : [...previa.historial, { ...ev.inspeccion, fecha: visita.fecha }];
      estado.set(ev.estacionId, {
        estacion: {
          id: ev.estacionId,
          numero: ev.numero,
          tipoEstacion: ev.tipoEstacion,
          colorIcono: consumo ? 'ROJO' : 'VERDE',
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
export function resumenDelMapa(estaciones: EstacionEnMapa[], visitas: VisitaMapa[], indice: number) {
  const contar = <K extends string>(claves: readonly K[], de: (e: EstacionEnMapa) => K) =>
    claves.reduce((acc, k) => ({ ...acc, [k]: estaciones.filter((e) => de(e) === k).length }), {} as Record<K, number>);
  return {
    estaciones: estaciones.length,
    circulos: estaciones.filter((e) => e.estacion.tipoEstacion === 'CEBO_RATICIDA').length,
    cuadrados: estaciones.filter((e) => e.estacion.tipoEstacion !== 'CEBO_RATICIDA').length,
    icono: contar(['VERDE', 'ROJO'] as const, (e) => e.estacion.colorIcono),
    aura: contar(NIVELES, (e) => e.estacion.colorAura),
    desde: visitas[Math.max(0, indice - 3)].fecha,
    hasta: visitas[indice].fecha,
  };
}
