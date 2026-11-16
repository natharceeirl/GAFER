import { estadoTrabajoDeSede, type EstadoTrabajo } from '@gafer/contracts';
import type { ServicioContratado } from './servicio-mapper';

/**
 * Acciones de estado de trabajo que el expediente ofrece al Administrador (GAF-99). El servidor es quien decide
 * si la transición vale; aquí solo se eligen los botones que tienen sentido para el estado actual.
 */
export interface AccionEstadoTrabajo {
  id: 'iniciar' | 'completar' | 'cancelar' | 'reabrir';
  etiqueta: string;
  destino: EstadoTrabajo;
  /** Cancelar y reabrir piden confirmación con motivo. */
  pideMotivo: boolean;
}

const INICIAR: AccionEstadoTrabajo = { id: 'iniciar', etiqueta: 'Iniciar', destino: 'EN_CURSO', pideMotivo: false };
const COMPLETAR: AccionEstadoTrabajo = { id: 'completar', etiqueta: 'Marcar completado', destino: 'COMPLETADO', pideMotivo: false };
const CANCELAR: AccionEstadoTrabajo = { id: 'cancelar', etiqueta: 'Cancelar', destino: 'CANCELADO', pideMotivo: true };
const REABRIR: AccionEstadoTrabajo = { id: 'reabrir', etiqueta: 'Reabrir', destino: 'EN_CURSO', pideMotivo: true };

const ACCIONES: Record<EstadoTrabajo, AccionEstadoTrabajo[]> = {
  PENDIENTE: [INICIAR, CANCELAR],
  EN_CURSO: [COMPLETAR, CANCELAR],
  COMPLETADO: [REABRIR],
  CANCELADO: [REABRIR],
};

export function accionesDeEstadoTrabajo(estado: EstadoTrabajo): AccionEstadoTrabajo[] {
  return ACCIONES[estado];
}

/** Estado de la sede calculado con la regla de `@gafer/contracts`; los servicios dados de baja no cuentan. */
export function estadoDeSede(servicios: readonly ServicioContratado[]): EstadoTrabajo | null {
  return estadoTrabajoDeSede(servicios.filter((s) => s.estado === 'ACTIVO').map((s) => s.estadoTrabajo));
}
