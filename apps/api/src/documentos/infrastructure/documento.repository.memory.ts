import { Injectable } from '@nestjs/common';
import { Documento } from '../domain/documento';
import { DocumentoRepository } from '../domain/ports/documento.repository';

// TODO: reemplazar por un adapter Postgres una vez definido el esquema de datos.
@Injectable()
export class DocumentoRepositoryMemory implements DocumentoRepository {
  private readonly store = new Map<string, Documento>();

  async guardar(documento: Documento): Promise<void> {
    this.store.set(documento.id, documento);
  }

  async buscarPorId(id: string): Promise<Documento | null> {
    return this.store.get(id) ?? null;
  }
}
