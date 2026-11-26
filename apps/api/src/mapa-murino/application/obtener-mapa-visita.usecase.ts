import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MapaVisita } from '@gafer/contracts';
import { estadoDelMapa, irradiacionDelMapa, resumenDelMapa } from '../domain/mapa';
import { MAPA_REPOSITORY, MapaRepository } from '../domain/ports/mapa.repository';

@Injectable()
export class ObtenerMapaVisitaUseCase {
  constructor(@Inject(MAPA_REPOSITORY) private readonly repo: MapaRepository) {}

  /** El mapa del plano tal como quedó al cierre de la visita: solo se repasan las visitas hasta esa. */
  async ejecutar(planoId: string, visitaId: string): Promise<MapaVisita> {
    const plano = await this.repo.buscarPlano(planoId);
    if (!plano) throw new NotFoundException(`Plano ${planoId} no encontrado`);

    const historial = await this.repo.historialDelPlano(planoId);
    const indice = historial.findIndex((v) => v.id === visitaId);
    if (indice < 0) throw new NotFoundException(`La visita ${visitaId} no tiene registro de estaciones en el plano ${planoId}`);

    const estaciones = estadoDelMapa(historial, indice).sort((a, b) => a.estacion.numero - b.estacion.numero);
    return {
      planoId,
      visitaId,
      fecha: historial[indice].fecha,
      estaciones: estaciones.map(({ planoId: _plano, ...resto }) => resto),
      resumen: resumenDelMapa(estaciones, historial, indice),
      irradiacion: irradiacionDelMapa(estaciones).map(({ planoId: _plano, ...resto }) => resto),
    };
  }
}
