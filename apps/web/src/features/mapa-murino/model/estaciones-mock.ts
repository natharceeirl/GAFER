import type { Estacion } from '@gafer/contracts';

export const ESTACIONES_PLANTA_KALLPA: Estacion[] = [
  { id: 'e1', numero: 1, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
  { id: 'e2', numero: 2, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
  { id: 'e3', numero: 3, colorIcono: 'VERDE', colorAura: 'VERDE' },
  { id: 'e4', numero: 4, colorIcono: 'ROJO', colorAura: 'VERDE' },
  { id: 'e5', numero: 5, colorIcono: 'VERDE', colorAura: 'AMARILLO' },
  { id: 'e6', numero: 6, colorIcono: 'ROJO', colorAura: 'AMARILLO' },
  { id: 'e7', numero: 7, colorIcono: 'VERDE', colorAura: 'NARANJA' },
  { id: 'e8', numero: 8, colorIcono: 'ROJO', colorAura: 'NARANJA' },
  { id: 'e9', numero: 9, colorIcono: 'ROJO', colorAura: 'ROJO' },
  { id: 'e10', numero: 10, colorIcono: 'ROJO', colorAura: 'ROJO' },
  { id: 'e11', numero: 11, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
  { id: 'e12', numero: 12, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
  { id: 'e13', numero: 13, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
  { id: 'e14', numero: 14, colorIcono: 'ROJO', colorAura: 'VERDE' },
  { id: 'e15', numero: 15, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
  { id: 'e16', numero: 16, colorIcono: 'VERDE', colorAura: 'AMARILLO' },
  { id: 'e17', numero: 17, colorIcono: 'ROJO', colorAura: 'NARANJA' },
  { id: 'e18', numero: 18, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' },
];

export function resumenPorAura(estaciones: Estacion[]) {
  return estaciones.reduce(
    (acc, e) => {
      acc[e.colorAura] += 1;
      return acc;
    },
    { SIN_COLOR: 0, VERDE: 0, AMARILLO: 0, NARANJA: 0, ROJO: 0 } as Record<Estacion['colorAura'], number>,
  );
}
