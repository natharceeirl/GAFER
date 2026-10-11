import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../database/types';
import { KYSELY_DATABASE } from '../../database/database.module';
import { PERSONAL_REPOSITORY, PersonalRepository } from '../domain/ports/personal.repository';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import { generarHashClave } from '../../auth/domain/clave-hash';

export interface AsignarClavePersonalCommand {
  personalId: string;
  clave: string;
  actorId?: string | null;
  actorUsuario: string;
  actorRol: string;
}

@Injectable()
export class AsignarClavePersonalUseCase {
  constructor(
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepository: PersonalRepository,
    @Inject(KYSELY_DATABASE)
    private readonly db: Kysely<GaferDatabase>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async execute(command: AsignarClavePersonalCommand): Promise<void> {
    const personal = await this.personalRepository.buscarPorId(command.personalId);
    if (!personal) {
      throw new NotFoundException(`Personal con ID ${command.personalId} no encontrado`);
    }

    if (!personal.usuario) {
      throw new BadRequestException(
        'El personal debe tener un nombre de usuario asignado antes de definir su clave',
      );
    }

    const hash = await generarHashClave(command.clave);

    await this.db
      .updateTable('personal')
      .set({
        clave_hash: hash,
        updated_at: new Date() as any,
      })
      .where('id', '=', command.personalId)
      .execute();

    await this.auditoriaService.registrarEvento({
      actorId: command.actorId ?? null,
      actorUsuario: command.actorUsuario,
      actorRol: command.actorRol,
      modulo: 'PERSONAL',
      accion: 'ASIGNAR_CLAVE_USUARIO',
      entidad: 'personal',
      entidadId: command.personalId,
      payloadAnterior: {
        personalId: command.personalId,
        usuario: personal.usuario,
      },
      payloadNuevo: {
        personalId: command.personalId,
        usuario: personal.usuario,
        claveAsignada: true,
      },
    });
  }
}
