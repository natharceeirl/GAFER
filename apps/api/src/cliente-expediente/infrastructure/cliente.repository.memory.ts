import { Injectable } from '@nestjs/common';
import { Cliente } from '../domain/cliente';
import { ClienteRepository } from '../domain/ports/cliente.repository';

// TODO: reemplazar por un adapter Postgres una vez definido el esquema de datos.
@Injectable()
export class ClienteRepositoryMemory implements ClienteRepository {
  private readonly store = new Map<string, Cliente>();

  async guardar(cliente: Cliente): Promise<void> {
    this.store.set(cliente.id, cliente);
  }

  async buscarPorId(id: string): Promise<Cliente | null> {
    return this.store.get(id) ?? null;
  }

  async buscarPorCodigoCorto(codigoCorto: string): Promise<Cliente | null> {
    for (const cliente of this.store.values()) {
      if (cliente.codigoCorto === codigoCorto) return cliente;
    }
    return null;
  }
}
