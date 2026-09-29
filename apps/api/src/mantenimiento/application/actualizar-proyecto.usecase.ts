import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PROYECTO_REPOSITORY, ProyectoRepository } from '../domain/ports/proyecto.repository';
import { Proyecto } from '../domain/proyecto';

export interface ActualizarProyectoCommand {
  id: string;
  nombre?: string;
  direccionSede?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  contactoNombre?: string;
  contactoCargo?: string;
  contactoTelefono?: string;
  observaciones?: string | null;
}

@Injectable()
export class ActualizarProyectoUseCase {
  constructor(
    @Inject(PROYECTO_REPOSITORY)
    private readonly proyectoRepository: ProyectoRepository,
  ) {}

  async execute(command: ActualizarProyectoCommand): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.buscarPorId(command.id);
    if (!proyecto) {
      throw new NotFoundException(`Sede/Proyecto con ID ${command.id} no encontrado`);
    }

    if (command.nombre && command.nombre !== proyecto.nombre) {
      const duplicado = await this.proyectoRepository.buscarPorClienteYNombre(
        proyecto.clienteId,
        command.nombre,
      );
      if (duplicado && duplicado.id !== proyecto.id) {
        throw new ConflictException(
          `El cliente ya posee una sede registrada con el nombre: ${command.nombre}`,
        );
      }
    }

    proyecto.actualizarDatos(command);
    await this.proyectoRepository.guardar(proyecto);
    return proyecto;
  }
}
