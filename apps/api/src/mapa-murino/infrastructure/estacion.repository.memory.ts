import { Injectable } from '@nestjs/common';
import { Estacion } from '../domain/estacion';
import { EstacionRepository } from '../domain/ports/estacion.repository';

// TODO: reemplazar por un adapter Postgres una vez definido el esquema de datos.
@Injectable()
export class EstacionRepositoryMemory implements EstacionRepository {
  private readonly store = new Map<string, Estacion>();

  async guardar(estacion: Estacion): Promise<void> {
    this.store.set(estacion.id, estacion);
  }

  async buscarPorId(id: string): Promise<Estacion | null> {
    if (!this.store.has(id)) {
      // Estación de cliente nuevo: arranca en VERDE / SIN_COLOR (sección 5.1).
      this.store.set(id, new Estacion(id, this.store.size + 1));
    }
    return this.store.get(id) ?? null;
  }
}
