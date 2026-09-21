import { Injectable } from '@nestjs/common';
import { Inspeccion } from '../domain/inspeccion';
import { InspeccionRepository } from '../domain/ports/inspeccion.repository';

// TODO: reemplazar por un adapter Postgres una vez definido el esquema de datos.
@Injectable()
export class InspeccionRepositoryMemory implements InspeccionRepository {
  private readonly store = new Map<string, Inspeccion>();

  async guardar(inspeccion: Inspeccion): Promise<void> {
    this.store.set(inspeccion.id, inspeccion);
  }

  async buscarPorId(id: string): Promise<Inspeccion | null> {
    return this.store.get(id) ?? null;
  }

  async buscarPorServicioId(servicioId: string): Promise<Inspeccion | null> {
    for (const inspeccion of this.store.values()) {
      if (inspeccion.servicioId === servicioId) {
        return inspeccion;
      }
    }
    return null;
  }
}
