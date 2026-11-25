import { ClienteCodigoPort } from '../domain/ports/cliente-codigo.port';

/** Para pruebas unitarias: clientes y códigos cortos fijos. */
export class ClienteCodigoMemory implements ClienteCodigoPort {
  constructor(private readonly codigos: Record<string, string> = {}) {}

  async buscarCodigoCorto(clienteId: string): Promise<string | null> {
    return this.codigos[clienteId] ?? null;
  }
}
