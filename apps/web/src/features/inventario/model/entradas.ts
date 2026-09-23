import type { Rol } from '../../auth/model/roles';
import type { StockInsumo } from './tipos';

export interface DatosEntrada {
  stockId: string;
  lote: string;
  cantidad: string;
  fecha: string;
  proveedor: string;
}

/**
 * Decisión C5: el Administrador registra compras y entradas de stock; el
 * Supervisor consulta y recibe las alertas. Los técnicos descuentan stock
 * automáticamente al cerrar servicios en la app.
 */
export function puedeRegistrarEntradas(rol: Rol): boolean {
  return rol === 'ADMINISTRADOR';
}

export function validarEntrada(d: DatosEntrada): Partial<Record<keyof DatosEntrada, string>> {
  const e: Partial<Record<keyof DatosEntrada, string>> = {};
  if (d.stockId === '') e.stockId = 'Seleccione el producto.';
  if (d.lote.trim() === '') e.lote = 'Campo obligatorio.';
  if (!(Number(d.cantidad) > 0)) e.cantidad = 'Ingrese una cantidad mayor a 0.';
  if (d.fecha === '') e.fecha = 'Campo obligatorio.';
  if (d.proveedor.trim() === '') e.proveedor = 'Campo obligatorio.';
  return e;
}

export function registrarEntrada(stock: StockInsumo[], d: DatosEntrada): StockInsumo[] {
  const base = stock.find((s) => s.id === d.stockId);
  if (!base) return stock;
  const lote = d.lote.trim().toUpperCase();
  const cantidad = Number(d.cantidad);
  const existente = stock.find((s) => s.producto === base.producto && s.lote === lote);
  if (existente) {
    return stock.map((s) =>
      s.id === existente.id ? { ...s, cantidadActual: s.cantidadActual + cantidad, ultimaActualizacion: d.fecha } : s,
    );
  }
  return [
    ...stock,
    { ...base, id: `${base.id}-${lote}`, lote, cantidadActual: cantidad, ultimaActualizacion: d.fecha },
  ];
}
