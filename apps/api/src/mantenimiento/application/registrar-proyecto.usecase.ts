import { Inject, Injectable } from '@nestjs/common';
import { Proyecto, ProyectoProps } from '../domain/proyecto';
import { PROYECTO_REPOSITORY, ProyectoRepository } from '../domain/ports/proyecto.repository';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../domain/ports/cliente.repository';

export type RegistrarProyectoCommand = ProyectoProps;

@Injectable()
export class RegistrarProyectoUseCase {
  constructor(
    @Inject(PROYECTO_REPOSITORY)
    private readonly proyectoRepository: ProyectoRepository,
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  async execute(command: RegistrarProyectoCommand): Promise<Proyecto> {
    const cliente = await this.clienteRepository.buscarPorId(command.clienteId);
    if (!cliente) {
      throw new Error(`No se encontró el cliente con ID: ${command.clienteId}`);
    }

    if (cliente.getEstado() !== 'ACTIVO') {
      throw new Error('No se pueden crear proyectos para un cliente inactivo');
    }

    const existingNombre = await this.proyectoRepository.buscarPorClienteYNombre(
      command.clienteId,
      command.nombre,
    );
    if (existingNombre) {
      throw new Error(`El cliente ya posee una sede registrada con el nombre: ${command.nombre}`);
    }

    const proyecto = new Proyecto(command);
    await this.proyectoRepository.guardar(proyecto);
    return proyecto;
  }
}
