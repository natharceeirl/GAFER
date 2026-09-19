import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../domain/ports/cliente.repository';
import { Cliente } from '../domain/cliente';

export interface ActualizarClienteCommand {
  id: string;
  razonSocial?: string;
  direccionFiscal?: string;
  giroNegocio?: string;
  contactoNombre?: string;
  contactoCargo?: string;
  contactoTelefono?: string;
  contactoCorreo?: string;
  camposExtra?: Record<string, unknown>;
}

@Injectable()
export class ActualizarClienteUseCase {
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  async execute(command: ActualizarClienteCommand): Promise<Cliente> {
    const cliente = await this.clienteRepository.buscarPorId(command.id);
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${command.id} no encontrado`);
    }

    cliente.actualizarDatos(command);
    await this.clienteRepository.guardar(cliente);
    return cliente;
  }
}
