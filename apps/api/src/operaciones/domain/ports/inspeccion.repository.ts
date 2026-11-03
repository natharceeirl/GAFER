import { Inspeccion } from '../inspeccion';

export interface InspeccionRepository {
  guardar(inspeccion: Inspeccion): Promise<void>;
  buscarPorId(id: string): Promise<Inspeccion | null>;
  buscarPorServicioId(servicioId: string): Promise<Inspeccion | null>;
  listarPorTecnico(tecnicoId: string): Promise<Inspeccion[]>;
  listarTodas?(): Promise<Inspeccion[]>;
}

export const INSPECCION_REPOSITORY = Symbol('INSPECCION_REPOSITORY');
