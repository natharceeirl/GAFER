import type { EventoEstacion, Punto, VisitaMapa } from '../mapa';

export interface PlanoMapa {
  id: string;
  proyectoId: string;
  nombre: string;
  puntos: Punto[];
  cerrado: boolean;
}

/** Visita programada del proyecto, tal como la necesita el mapa. */
export interface VisitaProgramadaMapa {
  id: string;
  proyectoId: string;
  /** AAAA-MM-DD */
  fecha: string;
  /** HH:mm */
  hora: string;
  estadoCampo: 'PENDIENTE' | 'EN_CURSO' | 'EN_REVISION';
}

/** Una visita en que el plano tuvo registro de estaciones, con lo que se vio ese día. */
export interface VisitaDelPlanoGuardada extends VisitaMapa {
  hora: string;
}

export interface MapaRepository {
  proyectoExiste(proyectoId: string): Promise<boolean>;
  /** Falla con `LimiteMapaExcedidoError` si el proyecto ya tiene 20 planos, y con `ConflictoMapaError` si el nombre ya existe en él. */
  crearPlano(plano: PlanoMapa): Promise<void>;
  contarPlanos(proyectoId: string): Promise<number>;
  buscarPlano(planoId: string): Promise<PlanoMapa | null>;
  listarPlanos(proyectoId: string): Promise<PlanoMapa[]>;
  buscarVisita(visitaId: string): Promise<VisitaProgramadaMapa | null>;
  /** Visitas del plano con registro, de la más antigua a la más reciente (fecha, hora, id). */
  historialDelPlano(planoId: string): Promise<VisitaDelPlanoGuardada[]>;
  /**
   * Guarda lo visto en una visita, reemplazando lo que hubiera de esa visita en ese plano. Es atómico y
   * serializa las escrituras del mismo plano: `decidir` recibe el historial vigente (sin la visita que se
   * reemplaza) y devuelve los eventos a guardar; si lanza, no se guarda nada.
   */
  registrarEnVisita(planoId: string, visitaId: string, decidir: (historial: VisitaDelPlanoGuardada[]) => EventoEstacion[]): Promise<void>;
}

export const MAPA_REPOSITORY = Symbol('MAPA_REPOSITORY');
