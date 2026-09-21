export interface StockInsumo {
  id: string;
  producto: string;
  lote: string;
  cantidadActual: number;
  unidad: string;
  umbralMinimo: number;
  ultimaActualizacion: string;
}

export function estaBajoUmbral(stock: StockInsumo): boolean {
  return stock.cantidadActual <= stock.umbralMinimo;
}
