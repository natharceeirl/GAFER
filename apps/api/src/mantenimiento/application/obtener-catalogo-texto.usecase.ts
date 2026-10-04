import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogoTexto } from '../domain/catalogo-texto';
import {
  CATALOGO_TEXTO_REPOSITORY,
  CatalogoTextoRepository,
} from '../domain/ports/catalogo-texto.repository';

@Injectable()
export class ObtenerCatalogoTextoUseCase {
  constructor(
    @Inject(CATALOGO_TEXTO_REPOSITORY)
    private readonly repository: CatalogoTextoRepository,
  ) {}

  async execute(id: string, rol?: string): Promise<CatalogoTexto> {
    const catalogo = await this.repository.buscarPorId(id);
    if (!catalogo) {
      throw new NotFoundException(`Catálogo de texto '${id}' no encontrado`);
    }

    if (catalogo.soloAdministrador && rol !== 'ADMINISTRADOR') {
      throw new ForbiddenException(
        `El catálogo '${id}' es de acceso exclusivo para ADMINISTRADOR`,
      );
    }

    return catalogo;
  }
}
