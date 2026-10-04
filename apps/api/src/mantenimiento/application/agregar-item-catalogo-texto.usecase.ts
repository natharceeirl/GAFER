import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogoTexto } from '../domain/catalogo-texto';
import {
  CATALOGO_TEXTO_REPOSITORY,
  CatalogoTextoRepository,
} from '../domain/ports/catalogo-texto.repository';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';

export interface AgregarItemCatalogoTextoCommand {
  id: string;
  item: string;
  actorId?: string | null;
  actorUsuario: string;
  actorRol: string;
}

@Injectable()
export class AgregarItemCatalogoTextoUseCase {
  constructor(
    @Inject(CATALOGO_TEXTO_REPOSITORY)
    private readonly repository: CatalogoTextoRepository,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async execute(command: AgregarItemCatalogoTextoCommand): Promise<CatalogoTexto> {
    const catalogo = await this.repository.buscarPorId(command.id);
    if (!catalogo) {
      throw new NotFoundException(`Catálogo de texto '${command.id}' no encontrado`);
    }

    if (catalogo.soloAdministrador && command.actorRol !== 'ADMINISTRADOR') {
      throw new ForbiddenException(
        `El catálogo '${command.id}' solo puede ser modificado por ADMINISTRADOR`,
      );
    }

    const payloadAnterior = { items: catalogo.items };
    catalogo.agregarItem(command.item);
    await this.repository.guardar(catalogo);

    await this.auditoriaService.registrarEvento({
      actorId: command.actorId ?? null,
      actorUsuario: command.actorUsuario,
      actorRol: command.actorRol,
      modulo: 'MANTENIMIENTO',
      accion: 'AGREGAR_ITEM_CATALOGO_TEXTO',
      entidad: 'catalogo_texto',
      entidadId: catalogo.id,
      payloadAnterior,
      payloadNuevo: { items: catalogo.items, itemAgregado: command.item.trim() },
    });

    return catalogo;
  }
}
