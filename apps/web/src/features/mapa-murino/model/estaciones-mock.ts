import type { Estacion } from '@gafer/contracts';

export interface PlanoMock {
  id: string;
  nombre: string;
}

export const PLANOS_MOCK: PlanoMock[] = [
  { id: 'planta-baja', nombre: 'Planta baja' },
  { id: 'primer-piso', nombre: 'Primer piso' },
  { id: 'banos', nombre: 'Baños' },
];

/**
 * Cada plano numera sus estaciones desde 1 — spec §5.5: "el sistema
 * soporta hasta 20 planos por proyecto", cada uno con sus propias
 * estaciones (hasta 100). Un edificio con habitaciones/pisos se
 * modela como planos separados, no como subdivisiones dentro de un
 * mismo lienzo.
 */
export const ESTACIONES_POR_PLANO: Record<string, Estacion[]> = {
  'planta-baja': [
    { id: 'pb-1', numero: 1, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
    { id: 'pb-2', numero: 2, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
    { id: 'pb-3', numero: 3, tipoEstacion: 'TRAMPA_MECANICA', colorIcono: 'VERDE', colorAura: 'VERDE' },
    { id: 'pb-4', numero: 4, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'ROJO', colorAura: 'VERDE' },
    { id: 'pb-5', numero: 5, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'AMARILLO' },
    { id: 'pb-6', numero: 6, tipoEstacion: 'TRAMPA_MECANICA', colorIcono: 'ROJO', colorAura: 'AMARILLO' },
    { id: 'pb-7', numero: 7, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'NARANJA' },
    { id: 'pb-8', numero: 8, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'ROJO', colorAura: 'NARANJA' },
  ],
  'primer-piso': [
    { id: 'pp-1', numero: 1, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'ROJO', colorAura: 'ROJO' },
    { id: 'pp-2', numero: 2, tipoEstacion: 'TRAMPA_MECANICA', colorIcono: 'ROJO', colorAura: 'ROJO' },
    { id: 'pp-3', numero: 3, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
    { id: 'pp-4', numero: 4, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
    { id: 'pp-5', numero: 5, tipoEstacion: 'TRAMPA_MECANICA', colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
    { id: 'pp-6', numero: 6, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'ROJO', colorAura: 'VERDE' },
  ],
  banos: [
    { id: 'ba-1', numero: 1, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
    { id: 'ba-2', numero: 2, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'AMARILLO' },
    { id: 'ba-3', numero: 3, tipoEstacion: 'TRAMPA_MECANICA', colorIcono: 'ROJO', colorAura: 'NARANJA' },
    { id: 'ba-4', numero: 4, tipoEstacion: 'CEBO_RATICIDA', colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
  ],
};

export function resumenPorAura(estaciones: Estacion[]) {
  return estaciones.reduce(
    (acc, e) => {
      acc[e.colorAura] += 1;
      return acc;
    },
    { SIN_COLOR: 0, VERDE: 0, AMARILLO: 0, NARANJA: 0, ROJO: 0 } as Record<Estacion['colorAura'], number>,
  );
}
