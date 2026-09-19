import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../domain/ports/cliente.repository';
import { Cliente } from '../domain/cliente';

@Injectable()
export class ActivarClienteUseCase {
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  async execute(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepository.buscarPorId(id);
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    cliente.activar();
    await this.clienteRepository.guardar(cliente);
    return cliente;
  }
}
