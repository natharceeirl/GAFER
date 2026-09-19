import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PERSONAL_REPOSITORY, PersonalRepository } from '../domain/ports/personal.repository';
import { Personal } from '../domain/personal';

@Injectable()
export class DesactivarPersonalUseCase {
  constructor(
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepository: PersonalRepository,
  ) {}

  async execute(id: string): Promise<Personal> {
    const personal = await this.personalRepository.buscarPorId(id);
    if (!personal) {
      throw new NotFoundException(`Personal con ID ${id} no encontrado`);
    }

    personal.desactivar();
    await this.personalRepository.guardar(personal);
    return personal;
  }
}
