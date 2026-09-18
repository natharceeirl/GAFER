import { Injectable } from '@nestjs/common';
import { Insumo } from '../domain/insumo';
import { InsumoRepository } from '../domain/ports/insumo.repository';

// TODO: reemplazar por un adapter Postgres una vez definido el esquema de datos.
@Injectable()
export class InsumoRepositoryMemory implements InsumoRepository {
  private readonly store = new Map<string, Insumo>();

  async guardar(insumo: Insumo): Promise<void> {
    this.store.set(insumo.id, insumo);
  }

  async buscarPorId(id: string): Promise<Insumo | null> {
    return this.store.get(id) ?? null;
  }

  async listarActivos(): Promise<Insumo[]> {
    return Array.from(this.store.values()).filter((i) => i.getEstado() === 'ACTIVO');
  }
}
