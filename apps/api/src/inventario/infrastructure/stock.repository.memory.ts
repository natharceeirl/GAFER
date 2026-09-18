import { Injectable } from '@nestjs/common';
import { StockInsumo } from '../domain/stock-insumo';
import { StockRepository } from '../domain/ports/stock.repository';

// TODO: reemplazar por un adapter Postgres una vez definido el esquema de datos.
@Injectable()
export class StockRepositoryMemory implements StockRepository {
  private readonly store = new Map<string, StockInsumo>();

  async guardar(stock: StockInsumo): Promise<void> {
    this.store.set(stock.insumoId, stock);
  }

  async buscarPorInsumoId(insumoId: string): Promise<StockInsumo | null> {
    if (!this.store.has(insumoId)) {
      // placeholder de arranque: 100 unidades, umbral mínimo 20.
      this.store.set(insumoId, new StockInsumo(insumoId, 100, 20));
    }
    return this.store.get(insumoId) ?? null;
  }
}
