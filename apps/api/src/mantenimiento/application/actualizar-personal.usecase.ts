import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PERSONAL_REPOSITORY, PersonalRepository } from '../domain/ports/personal.repository';
import { CargoPersonal, Personal } from '../domain/personal';

export interface ActualizarPersonalCommand {
  id: string;
  dni?: string;
  nombres?: string;
  apellidos?: string;
  cargo?: CargoPersonal;
  telefono?: string;
  usuario?: string | null;
}

@Injectable()
export class ActualizarPersonalUseCase {
  constructor(
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepository: PersonalRepository,
  ) {}

  async execute(command: ActualizarPersonalCommand): Promise<Personal> {
    const personal = await this.personalRepository.buscarPorId(command.id);
    if (!personal) {
      throw new NotFoundException(`Personal con ID ${command.id} no encontrado`);
    }

    if (command.dni && command.dni !== personal.dni) {
      const existingDni = await this.personalRepository.buscarPorDni(command.dni);
      if (existingDni && existingDni.id !== command.id) {
        throw new ConflictException(
          `Ya existe un colaborador registrado con el DNI: ${command.dni}`,
        );
      }
    }

    if (command.usuario && command.usuario.trim().toUpperCase() !== personal.usuario) {
      const existingUser = await this.personalRepository.buscarPorUsuario(
        command.usuario.trim().toUpperCase(),
      );
      if (existingUser && existingUser.id !== command.id) {
        throw new ConflictException(
          `Ya existe un usuario en el sistema con el username: ${command.usuario}`,
        );
      }
    }

    personal.actualizarDatos(command);
    await this.personalRepository.guardar(personal);
    return personal;
  }
}
