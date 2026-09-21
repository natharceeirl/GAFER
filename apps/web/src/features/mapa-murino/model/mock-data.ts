import type { Estacion } from '@gafer/contracts';
import type { RegistroHistorialEstacion } from './tipos';

export const ESTACION_MOCK: Estacion = {
  id: '9f7c1e2a-6b3d-4a11-8e2f-2c4d5b6a7c8d',
  numero: 12,
  colorIcono: 'ROJO',
  colorAura: 'NARANJA',
};

export const TIPOS_CEBO_MOCK = ['Bloque parafinado', 'Pellet', 'Cebo en pasta', 'Grano tratado'];

export const HISTORIAL_MOCK: RegistroHistorialEstacion[] = [
  {
    fecha: '2026-08-07',
    tipoCebo: 'Bloque parafinado',
    cantidadColocada: '2',
    cantidadConsumida: '0',
    estadoFisico: 'BUENAS_CONDICIONES',
    observaciones: 'Sin novedad',
  },
  {
    fecha: '2026-08-21',
    tipoCebo: 'Bloque parafinado',
    cantidadColocada: '2',
    cantidadConsumida: '1',
    estadoFisico: 'BUENAS_CONDICIONES',
    observaciones: 'Consumo parcial detectado',
  },
  {
    fecha: '2026-09-04',
    tipoCebo: 'Pellet',
    cantidadColocada: '3',
    cantidadConsumida: '3',
    estadoFisico: 'MALAS_CONDICIONES',
    observaciones: 'Humedad en la estación, se repuso cebo',
  },
];
