import { MONEDAS_VALIDAS, MONTO_MAXIMO, type Moneda } from '@gafer/contracts';

/** Valida invariantes de monto y moneda para entidades de mantenimiento (GAF-105). */
export function validarMontoYMoneda(
  monto: number | null,
  moneda: Moneda | null,
  etiqueta: 'presupuesto' | 'monto',
): void {
  if (monto !== null) {
    if (typeof monto !== 'number' || !Number.isFinite(monto)) {
      throw new Error(`El ${etiqueta} debe ser un número válido`);
    }
    if (monto < 0) {
      throw new Error(`El ${etiqueta} no puede ser negativo`);
    }
    if (monto > MONTO_MAXIMO) {
      throw new Error(`El ${etiqueta} no puede superar ${MONTO_MAXIMO}`);
    }
  }

  if (moneda !== null && !MONEDAS_VALIDAS.includes(moneda)) {
    throw new Error(
      `Moneda no válida: ${String(moneda)}. Debe ser una de: ${MONEDAS_VALIDAS.join(', ')}`,
    );
  }

  if (monto !== null && moneda === null) {
    throw new Error(`Si especifica un ${etiqueta}, debe indicar la moneda`);
  }

  if (monto === null && moneda !== null) {
    throw new Error(`No se puede especificar una moneda sin un ${etiqueta}`);
  }
}
