export interface RegistroHistorialEstacion {
  fecha: string;
  tipoCebo: string;
  cantidadColocada: string;
  cantidadConsumida: string;
  estadoFisico: 'BUENAS_CONDICIONES' | 'MALAS_CONDICIONES';
  observaciones: string;
}

export type PorcentajeConsumo = '0' | '25' | '50' | '75' | '100';

export interface VisitaActualEstacion {
  tipoCebo: string;
  porcentajeConsumo: PorcentajeConsumo | '';
  estadoSiNoConsumo: 'BUENAS_CONDICIONES' | 'MALAS_CONDICIONES' | '';
  problemas: { agua: boolean; polvo: boolean; calor: boolean };
  cantidadRepuesta: string;
}

export function crearVisitaVacia(): VisitaActualEstacion {
  return {
    tipoCebo: '',
    porcentajeConsumo: '',
    estadoSiNoConsumo: '',
    problemas: { agua: false, polvo: false, calor: false },
    cantidadRepuesta: '',
  };
}
