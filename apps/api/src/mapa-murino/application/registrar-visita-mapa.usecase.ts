import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MapaVisita, RegistrarVisitaMapa } from '@gafer/contracts';
import { estadoDelMapa } from '../domain/mapa';
import { MAPA_REPOSITORY, MapaRepository } from '../domain/ports/mapa.repository';
import { claveDeOrden, ConflictoMapaError, construirEventos, ReglaMapaError } from '../domain/registro-visita';
import { ObtenerMapaVisitaUseCase } from './obtener-mapa-visita.usecase';

@Injectable()
export class RegistrarVisitaMapaUseCase {
  private readonly obtenerMapa: ObtenerMapaVisitaUseCase;

  constructor(@Inject(MAPA_REPOSITORY) private readonly repo: MapaRepository) {
    this.obtenerMapa = new ObtenerMapaVisitaUseCase(repo);
  }

  /**
   * Guarda lo que el técnico vio en el plano durante la visita y devuelve el mapa resultante. Volver a registrar
   * la misma visita la reemplaza mientras sea la más reciente del plano y no esté en revisión: el pasado no se reescribe.
   */
  async ejecutar(planoId: string, visitaId: string, datos: RegistrarVisitaMapa): Promise<MapaVisita> {
    const plano = await this.repo.buscarPlano(planoId);
    if (!plano) throw new NotFoundException(`Plano ${planoId} no encontrado`);
    const visita = await this.repo.buscarVisita(visitaId);
    if (!visita) throw new NotFoundException(`Visita ${visitaId} no encontrada`);
    if (visita.proyectoId !== plano.proyectoId) throw new ReglaMapaError('La visita no es del mismo proyecto que el plano');
    if (visita.estadoCampo === 'EN_REVISION') {
      throw new ConflictoMapaError(`La visita ${visitaId} está en revisión: su mapa no se puede modificar`);
    }

    const clave = claveDeOrden(visita.fecha, visita.hora, visita.id);
    await this.repo.registrarEnVisita(planoId, visitaId, (historial) => {
      if (historial.some((v) => claveDeOrden(v.fecha, v.hora, v.id) > clave)) {
        throw new ConflictoMapaError('Ya hay visitas posteriores con registro en este plano: el mapa de una visita pasada no se reescribe');
      }
      const previo = historial.length > 0 ? estadoDelMapa(historial, historial.length - 1) : [];
      return construirEventos(planoId, visita.fecha, previo, datos.estaciones);
    });

    return this.obtenerMapa.ejecutar(planoId, visitaId);
  }
}
