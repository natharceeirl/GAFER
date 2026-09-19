import { Inject, Injectable } from '@nestjs/common';
import { Cliente, ClienteProps } from '../domain/cliente';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../domain/ports/cliente.repository';

export type RegistrarClienteCommand = ClienteProps;

@Injectable()
export class RegistrarClienteUseCase {
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  async execute(command: RegistrarClienteCommand): Promise<Cliente> {
    const existingByRuc = await this.clienteRepository.buscarPorRuc(command.ruc);
    if (existingByRuc) {
      throw new Error(`Ya existe un cliente registrado con el RUC: ${command.ruc}`);
    }

    const existingByCodigo = await this.clienteRepository.buscarPorCodigoCorto(command.codigoCorto);
    if (existingByCodigo) {
      throw new Error(`Ya existe un cliente con el código corto: ${command.codigoCorto}`);
    }

    const cliente = new Cliente(command);
    await this.clienteRepository.guardar(cliente);
    return cliente;
  }
}
