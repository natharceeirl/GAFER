import { Injectable } from '@nestjs/common';
import { Inspeccion } from '../domain/inspeccion';
import { InspeccionRepository } from '../domain/ports/inspeccion.repository';

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

  async listarPorTecnico(tecnicoId: string): Promise<Inspeccion[]> {
    const res: Inspeccion[] = [];
    for (const inspeccion of this.store.values()) {
      const participa = inspeccion.tecnicosParticipantes.some((t) => t.id === tecnicoId);
      if (participa) {
        res.push(inspeccion);
      }
    }
    return res;
  }

  async listarTodas(): Promise<Inspeccion[]> {
    return Array.from(this.store.values());
  }
}
