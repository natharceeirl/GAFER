import type { StockInsumo } from './tipos';

export const STOCK_MOCK: StockInsumo[] = [
  { id: 's1', producto: 'Brodifacoum 0.005% bloque parafinado', lote: 'L-2451', cantidadActual: 4.2, unidad: 'kg', umbralMinimo: 5, ultimaActualizacion: '2026-09-17' },
  { id: 's2', producto: 'Cipermetrina 25% EC', lote: 'L-2298', cantidadActual: 18, unidad: 'L', umbralMinimo: 8, ultimaActualizacion: '2026-09-16' },
  { id: 's3', producto: 'Bromadiolona 0.005% pellet', lote: 'L-2510', cantidadActual: 1.8, unidad: 'kg', umbralMinimo: 3, ultimaActualizacion: '2026-09-17' },
  { id: 's4', producto: 'Deltametrina 2.5% SC', lote: 'L-2103', cantidadActual: 22, unidad: 'L', umbralMinimo: 10, ultimaActualizacion: '2026-09-10' },
  { id: 's5', producto: 'Gel cebo insecticida', lote: 'L-2599', cantidadActual: 6, unidad: 'tubos', umbralMinimo: 6, ultimaActualizacion: '2026-09-15' },
];
