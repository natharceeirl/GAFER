import { StockInsumo } from '../stock-insumo';

export interface StockRepository {
  guardar(stock: StockInsumo): Promise<void>;
  buscarPorInsumoId(insumoId: string): Promise<StockInsumo | null>;
}

export const STOCK_REPOSITORY = Symbol('STOCK_REPOSITORY');
