import { MONEDAS_VALIDAS, MONTO_MAXIMO, type Moneda } from '@gafer/contracts';

/** Campo del contrato HTTP al que se atribuye un incumplimiento de monto o moneda. */
export type CampoMonto = 'monto' | 'montoPresupuestado' | 'moneda';

/** Incumplimiento de una invariante de monto/moneda; `campo` permite a la capa de transporte señalar el campo. */
export class MontoMonedaError extends Error {
  constructor(
    readonly campo: CampoMonto,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'MontoMonedaError';
  }
}

/** Valida invariantes de monto y moneda para entidades de mantenimiento (GAF-105). */
export function validarMontoYMoneda(
  monto: number | null,
  moneda: Moneda | null,
  etiqueta: 'presupuesto' | 'monto',
): void {
  const campoMonto: CampoMonto = etiqueta === 'presupuesto' ? 'montoPresupuestado' : 'monto';
  if (monto !== null) {
    if (typeof monto !== 'number' || !Number.isFinite(monto)) {
      throw new MontoMonedaError(campoMonto, `El ${etiqueta} debe ser un número válido`);
    }
    if (monto < 0) {
      throw new MontoMonedaError(campoMonto, `El ${etiqueta} no puede ser negativo`);
    }
    if (monto > MONTO_MAXIMO) {
      throw new MontoMonedaError(campoMonto, `El ${etiqueta} no puede superar ${MONTO_MAXIMO}`);
    }
  }

  if (moneda !== null && !MONEDAS_VALIDAS.includes(moneda)) {
    throw new MontoMonedaError(
      'moneda',
      `Moneda no válida: ${String(moneda)}. Debe ser una de: ${MONEDAS_VALIDAS.join(', ')}`,
    );
  }

  if (monto !== null && moneda === null) {
    throw new MontoMonedaError('moneda', `Si especifica un ${etiqueta}, debe indicar la moneda`);
  }

  if (monto === null && moneda !== null) {
    throw new MontoMonedaError('moneda', `No se puede especificar una moneda sin un ${etiqueta}`);
  }
}
