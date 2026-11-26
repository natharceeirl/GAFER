import { ConflictoMapaError, LimiteMapaExcedidoError, claveDeOrden } from '../domain/registro-visita';
import { EventoEstacion, LIMITES_MAPA } from '../domain/mapa';
import {
  MapaRepository,
  PlanoMapa,
  VisitaDelPlanoGuardada,
  VisitaProgramadaMapa,
} from '../domain/ports/mapa.repository';

/**
 * Repositorio en memoria para pruebas unitarias. Aplica las mismas garantías que las restricciones de la base
 * (límites, números únicos por plano, visita en revisión inmutable) para que un caso de uso se pruebe igual con ambos.
 */
export class MapaRepositoryMemory implements MapaRepository {
  private readonly proyectos = new Set<string>();
  private readonly planos = new Map<string, PlanoMapa>();
  private readonly visitas = new Map<string, VisitaProgramadaMapa>();
  /** planoId -> visitaId -> eventos */
  private readonly eventos = new Map<string, Map<string, EventoEstacion[]>>();
  /** planoId -> numero -> estacionId (una estación retirada sigue ocupando su número, como en la base) */
  private readonly numeros = new Map<string, Map<number, string>>();

  sembrarProyecto(proyectoId: string): void {
    this.proyectos.add(proyectoId);
  }

  sembrarVisita(visita: VisitaProgramadaMapa): void {
    this.visitas.set(visita.id, { ...visita });
  }

  cambiarEstadoVisita(visitaId: string, estadoCampo: VisitaProgramadaMapa['estadoCampo']): void {
    const visita = this.visitas.get(visitaId);
    if (visita) visita.estadoCampo = estadoCampo;
  }

  async proyectoExiste(proyectoId: string): Promise<boolean> {
    return this.proyectos.has(proyectoId);
  }

  async contarPlanos(proyectoId: string): Promise<number> {
    return [...this.planos.values()].filter((p) => p.proyectoId === proyectoId).length;
  }

  async crearPlano(plano: PlanoMapa): Promise<void> {
    const delProyecto = [...this.planos.values()].filter((p) => p.proyectoId === plano.proyectoId);
    if (delProyecto.some((p) => p.nombre === plano.nombre)) {
      throw new ConflictoMapaError(`Ya existe un plano llamado "${plano.nombre}" en el proyecto`);
    }
    if (delProyecto.length >= LIMITES_MAPA.planosPorProyecto) {
      throw new LimiteMapaExcedidoError(`Un proyecto admite hasta ${LIMITES_MAPA.planosPorProyecto} planos`);
    }
    this.planos.set(plano.id, structuredClone(plano));
  }

  async buscarPlano(planoId: string): Promise<PlanoMapa | null> {
    const plano = this.planos.get(planoId);
    return plano ? structuredClone(plano) : null;
  }

  async listarPlanos(proyectoId: string): Promise<PlanoMapa[]> {
    return [...this.planos.values()].filter((p) => p.proyectoId === proyectoId).map((p) => structuredClone(p));
  }

  async buscarVisita(visitaId: string): Promise<VisitaProgramadaMapa | null> {
    const visita = this.visitas.get(visitaId);
    return visita ? { ...visita } : null;
  }

  async historialDelPlano(planoId: string): Promise<VisitaDelPlanoGuardada[]> {
    const delPlano = this.eventos.get(planoId) ?? new Map<string, EventoEstacion[]>();
    return [...delPlano.entries()]
      .map(([visitaId, eventos]) => {
        const visita = this.visitas.get(visitaId)!;
        return {
          id: visita.id,
          fecha: visita.fecha,
          hora: visita.hora,
          tecnico: '',
          eventos: structuredClone(eventos),
        };
      })
      .sort((a, b) => claveDeOrden(a.fecha, a.hora, a.id).localeCompare(claveDeOrden(b.fecha, b.hora, b.id)));
  }

  async registrarEnVisita(
    planoId: string,
    visitaId: string,
    decidir: (historial: VisitaDelPlanoGuardada[]) => EventoEstacion[],
  ): Promise<void> {
    const visita = this.visitas.get(visitaId);
    const plano = this.planos.get(planoId);
    if (!visita || !plano) throw new Error('Plano o visita no existe');
    if (visita.estadoCampo === 'EN_REVISION') {
      throw new ConflictoMapaError(`La visita ${visitaId} está en revisión: su mapa no se puede modificar`);
    }
    if (visita.proyectoId !== plano.proyectoId) throw new ConflictoMapaError('La visita y el plano no son del mismo proyecto');

    const historial = (await this.historialDelPlano(planoId)).filter((v) => v.id !== visitaId);
    const nuevos = decidir(historial);

    const usados = new Map(this.numeros.get(planoId) ?? []);
    for (const e of nuevos) {
      const dueno = usados.get(e.numero);
      if (dueno && dueno !== e.estacionId) {
        throw new ConflictoMapaError(`El número ${e.numero} ya lo usa otra estación del plano`);
      }
      usados.set(e.numero, e.estacionId);
    }

    this.numeros.set(planoId, usados);
    const delPlano = this.eventos.get(planoId) ?? new Map<string, EventoEstacion[]>();
    delPlano.set(visitaId, structuredClone(nuevos));
    this.eventos.set(planoId, delPlano);
  }
}
