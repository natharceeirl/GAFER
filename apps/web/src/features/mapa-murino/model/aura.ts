import type { ColorAura, Estacion } from '@gafer/contracts';

const ORDEN_AURA: ColorAura[] = ['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO'];

/**
 * Misma regla que apps/api/src/mapa-murino/domain/estacion.ts (dominio
 * puro, testeado ahí) — el mockup tiene que calcular exactamente igual
 * que el backend: sube o baja UN nivel por visita, nunca salta de ROJO
 * a VERDE ni de sin color a ROJO en una sola inspección (spec §5.3).
 */
export function calcularSiguienteAura(actual: ColorAura, huboConsumo: boolean): ColorAura {
  const indiceActual = ORDEN_AURA.indexOf(actual);
  if (huboConsumo) {
    const siguiente = Math.min(indiceActual + 1, ORDEN_AURA.length - 1);
    return ORDEN_AURA[siguiente];
  }
  const anterior = Math.max(indiceActual - 1, 0);
  return ORDEN_AURA[anterior];
}

export const TIPOS_CEBO_MOCK = ['Bloque parafinado', 'Pellet', 'Cebo en pasta', 'Trampa mecánica'] as const;

export type PorcentajeConsumo = 0 | 25 | 50 | 75 | 100;

export interface InspeccionRegistrada {
  fecha: string;
  huboConsumo: boolean;
  porcentajeConsumo?: PorcentajeConsumo;
  tipoCebo: string;
  estadoFisico?: 'BUENAS_CONDICIONES' | 'MALAS_CONDICIONES';
}

export interface Punto {
  x: number;
  y: number;
}

/**
 * Estado único de una estación, compartido entre el lienzo (posición
 * en el plano) y la grilla de abajo (lista clicable) — una sola fuente
 * de verdad, para que las dos vistas nunca queden desincronizadas.
 */
export interface EstacionConEstado {
  estacion: Estacion;
  historial: InspeccionRegistrada[];
  posicion: Punto | null;
}

export function estacionInicial(estacion: Estacion): EstacionConEstado {
  return { estacion, historial: [], posicion: null };
}

/**
 * Estado completo de un plano: su propio terreno (puntos + si está
 * cerrado) y sus propias estaciones — cada plano es independiente del
 * resto (spec §5.5, "hasta 20 planos por proyecto").
 */
export interface EstadoPlano {
  id: string;
  nombre: string;
  puntos: Punto[];
  cerrado: boolean;
  estaciones: EstacionConEstado[];
}

