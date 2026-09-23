import type { PersonalOperativo } from '../../mantenimiento/model/tipos';

/** Estado de la visita según lo que va llegando desde la app Android de los técnicos. */
export type EstadoCampo = 'PENDIENTE' | 'EN_CURSO' | 'EN_REVISION';

/**
 * Visita programada (§8.1). Modelo híbrido (decisión C12): el técnico
 * titular es opcional y solo ordena su agenda; cualquier técnico activo
 * puede atenderla desde la app (§8.2).
 */
export interface VisitaProgramada {
  id: string;
  fecha: string;
  hora: string;
  clienteId: string;
  proyectoId: string;
  servicioId: string;
  tecnicoTitularId: string | null;
  observaciones: string;
  estadoCampo: EstadoCampo;
}

export interface DatosVisita {
  clienteId: string;
  proyectoId: string;
  servicioId: string;
  fecha: string;
  hora: string;
  tecnicoTitularId: string;
  observaciones: string;
}

const OBLIGATORIO = 'Campo obligatorio.';

export function validarVisita(d: DatosVisita, hoy: string): Partial<Record<keyof DatosVisita, string>> {
  const e: Partial<Record<keyof DatosVisita, string>> = {};
  if (d.clienteId === '' || d.proyectoId === '') e.proyectoId = 'Seleccione el cliente y la sede.';
  if (d.servicioId === '') e.servicioId = OBLIGATORIO;
  if (d.fecha === '') e.fecha = OBLIGATORIO;
  else if (d.fecha < hoy) e.fecha = 'No se puede programar una visita en una fecha pasada.';
  if (!/^\d{2}:\d{2}$/.test(d.hora)) e.hora = OBLIGATORIO;
  return e;
}

export function agregarVisita(visitas: VisitaProgramada[], d: DatosVisita): VisitaProgramada[] {
  const visita: VisitaProgramada = {
    id: `v-${d.fecha}-${d.hora}-${d.servicioId}-${visitas.length + 1}`,
    fecha: d.fecha,
    hora: d.hora,
    clienteId: d.clienteId,
    proyectoId: d.proyectoId,
    servicioId: d.servicioId,
    tecnicoTitularId: d.tecnicoTitularId === '' ? null : d.tecnicoTitularId,
    observaciones: d.observaciones.trim(),
    estadoCampo: 'PENDIENTE',
  };
  return [...visitas, visita];
}

export function agendaDelDia(visitas: VisitaProgramada[], fecha: string): VisitaProgramada[] {
  return visitas.filter((v) => v.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));
}

export function tecnicosDisponibles(personal: PersonalOperativo[]): PersonalOperativo[] {
  return personal.filter((p) => p.cargo === 'Técnico Operador' && p.estado === 'ACTIVO');
}
