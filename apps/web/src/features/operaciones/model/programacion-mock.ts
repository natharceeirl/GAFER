/** Visitas programadas por el Administrador o Supervisor para hoy (§8.1). */
export interface VisitaProgramada {
  id: string;
  hora: string;
  clienteId: string;
  proyectoId: string;
  servicioId: string;
  tecnico: string;
}

export const PROGRAMACION_HOY: VisitaProgramada[] = [
  { id: 'prog-1', hora: '08:00', clienteId: 'c1', proyectoId: 'p1', servicioId: 's-p1-drt', tecnico: 'Marco Ipusari' },
  { id: 'prog-2', hora: '10:30', clienteId: 'c2', proyectoId: 'p2', servicioId: 's-p2-dsf', tecnico: 'Jorge Huamán' },
  { id: 'prog-3', hora: '15:00', clienteId: 'c1', proyectoId: 'p1', servicioId: 's-p1-lra', tecnico: 'Marco Ipusari' },
];
