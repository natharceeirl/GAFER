import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cliente } from '../domain/cliente';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../domain/ports/cliente.repository';

@Injectable()
export class RegistrarClienteUseCase {
  constructor(
    @Inject(CLIENTE_REPOSITORY) private readonly repo: ClienteRepository,
  ) {}

  async ejecutar(codigoCorto: string, razonSocial: string): Promise<Cliente> {
    const existente = await this.repo.buscarPorCodigoCorto(codigoCorto);
    if (existente) {
      throw new ConflictException(`Ya existe un cliente con código ${codigoCorto}`);
    }
    const cliente = new Cliente(randomUUID(), codigoCorto, razonSocial);
    await this.repo.guardar(cliente);
    return cliente;
  }
}
