import { estadoTrabajoDeSede, type EstadoTrabajo, type EstadoVisibleTrabajo } from '@gafer/contracts';
import type { ServicioContratado } from './servicio-mapper';

/**
 * Acciones de estado de trabajo que el expediente ofrece al Administrador (GAF-99). El servidor es quien decide
 * si la transición vale; aquí solo se eligen los botones que tienen sentido para el estado actual.
 */
export interface AccionEstadoTrabajo {
  id: 'ejecutar' | 'concluir' | 'cancelar' | 'reabrir';
  etiqueta: string;
  destino: EstadoTrabajo;
  /** Cancelar y reabrir piden confirmación con motivo. */
  pideMotivo: boolean;
}

const EJECUTAR: AccionEstadoTrabajo = { id: 'ejecutar', etiqueta: 'Marcar ejecutado', destino: 'EJECUTADO', pideMotivo: false };
const CONCLUIR: AccionEstadoTrabajo = { id: 'concluir', etiqueta: 'Marcar concluido', destino: 'CONCLUIDO', pideMotivo: false };
const CANCELAR: AccionEstadoTrabajo = { id: 'cancelar', etiqueta: 'Cancelar', destino: 'CANCELADO', pideMotivo: true };
const REABRIR: AccionEstadoTrabajo = { id: 'reabrir', etiqueta: 'Reabrir', destino: 'EJECUTADO', pideMotivo: true };

const ACCIONES: Record<EstadoTrabajo, AccionEstadoTrabajo[]> = {
  PROGRAMADO: [EJECUTAR, CANCELAR],
  EJECUTADO: [CONCLUIR, CANCELAR],
  CONCLUIDO: [REABRIR],
  CANCELADO: [REABRIR],
};

export function accionesDeEstadoTrabajo(estado: EstadoTrabajo): AccionEstadoTrabajo[] {
  return ACCIONES[estado];
}

/** Estado de la sede calculado con la regla de `@gafer/contracts` sobre el estado visible; los servicios dados de baja no cuentan. */
export function estadoDeSede(servicios: readonly ServicioContratado[]): EstadoVisibleTrabajo | null {
  return estadoTrabajoDeSede(servicios.filter((s) => s.estado === 'ACTIVO').map((s) => s.estadoVisible));
}
