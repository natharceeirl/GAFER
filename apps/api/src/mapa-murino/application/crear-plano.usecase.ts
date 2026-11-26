import { randomUUID } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CrearPlano } from '@gafer/contracts';
import { LIMITES_MAPA } from '../domain/mapa';
import { MAPA_REPOSITORY, MapaRepository, PlanoMapa } from '../domain/ports/mapa.repository';
import { LimiteMapaExcedidoError } from '../domain/registro-visita';

@Injectable()
export class CrearPlanoUseCase {
  constructor(@Inject(MAPA_REPOSITORY) private readonly repo: MapaRepository) {}

  async ejecutar(proyectoId: string, datos: CrearPlano): Promise<PlanoMapa> {
    if (!(await this.repo.proyectoExiste(proyectoId))) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
    if ((await this.repo.contarPlanos(proyectoId)) >= LIMITES_MAPA.planosPorProyecto) {
      throw new LimiteMapaExcedidoError(`Un proyecto admite hasta ${LIMITES_MAPA.planosPorProyecto} planos`);
    }
    // La base vuelve a exigir el límite al insertar, así que dos altas simultáneas tampoco lo superan.
    const plano: PlanoMapa = { id: randomUUID(), proyectoId, nombre: datos.nombre, puntos: datos.puntos, cerrado: datos.cerrado };
    await this.repo.crearPlano(plano);
    return plano;
  }
}
