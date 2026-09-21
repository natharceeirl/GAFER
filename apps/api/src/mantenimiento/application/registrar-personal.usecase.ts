import { Inject, Injectable } from '@nestjs/common';
import { Personal, PersonalProps } from '../domain/personal';
import { PERSONAL_REPOSITORY, PersonalRepository } from '../domain/ports/personal.repository';

export type RegistrarPersonalCommand = PersonalProps;

@Injectable()
export class RegistrarPersonalUseCase {
  constructor(
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepository: PersonalRepository,
  ) {}

  async execute(command: RegistrarPersonalCommand): Promise<Personal> {
    const existingDni = await this.personalRepository.buscarPorDni(command.dni);
    if (existingDni) {
      throw new Error(`Ya existe un colaborador registrado con el DNI: ${command.dni}`);
    }

    if (command.usuario) {
      const existingUser = await this.personalRepository.buscarPorUsuario(command.usuario);
      if (existingUser) {
        throw new Error(`Ya existe un usuario en el sistema con el username: ${command.usuario}`);
      }
    }

    const personal = new Personal(command);
    await this.personalRepository.guardar(personal);
    return personal;
  }
}
