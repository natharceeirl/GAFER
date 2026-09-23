import type { Estacion } from '@gafer/contracts';

export type PorcentajeConsumo = 0 | 25 | 50 | 75 | 100;

/**
 * Datos de entrada por inspección — spec §5.1. Se registran siempre:
 * tipo de cebo, cantidad en gramos, lote y vencimiento del producto
 * instalado. Según haya consumo o no, se suma cantidad de reposición
 * (si "Sí") o cantidad repuesta junto al estado físico (si "No").
 */
export interface InspeccionRegistrada {
  fecha: string;
  tipoCebo: string;
  cantidadGramos: number;
  lote: string;
  vencimiento: string;
  huboConsumo: boolean;
  porcentajeConsumo?: PorcentajeConsumo;
  cantidadReposicion?: number;
  estadoFisico?: 'BUENAS_CONDICIONES' | 'MALAS_CONDICIONES';
  cantidadRepuesta?: number;
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

export function estacionInicial(estacion: Estacion, historial: InspeccionRegistrada[] = []): EstacionConEstado {
  return { estacion, historial, posicion: null };
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

