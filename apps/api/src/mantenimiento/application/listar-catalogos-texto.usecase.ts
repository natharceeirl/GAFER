import { Inject, Injectable } from '@nestjs/common';
import { CatalogoTexto } from '../domain/catalogo-texto';
import {
  CATALOGO_TEXTO_REPOSITORY,
  CatalogoTextoRepository,
} from '../domain/ports/catalogo-texto.repository';

@Injectable()
export class ListarCatalogosTextoUseCase {
  constructor(
    @Inject(CATALOGO_TEXTO_REPOSITORY)
    private readonly repository: CatalogoTextoRepository,
  ) {}

  async execute(rol?: string): Promise<CatalogoTexto[]> {
    const catalogos = await this.repository.listar();
    if (rol !== 'ADMINISTRADOR') {
      return catalogos.filter((c) => !c.soloAdministrador);
    }
    return catalogos;
  }
}
