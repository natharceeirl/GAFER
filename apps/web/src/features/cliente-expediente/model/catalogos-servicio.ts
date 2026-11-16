import type { ColorAura, EstadoActivoInactivo, EstadoTrabajo, FrecuenciaServicio, TipoServicio } from '@gafer/contracts';

/**
 * Único módulo donde el código del API se convierte en etiqueta de pantalla (y al revés) para los
 * servicios contratados: tipo, frecuencia, estado y estado de trabajo. Los componentes y las validaciones trabajan con
 * los códigos de `@gafer/contracts`; solo al dibujar el texto pasan por aquí.
 */

/** Los 7 tipos de servicio (§4). Solo el desarrollador los edita (§7.7), por eso son fijos en código. */
export const TIPOS_SERVICIO: Array<{ id: TipoServicio; nombre: string }> = [
  { id: 'DSF', nombre: 'Desinfección' },
  { id: 'DSS', nombre: 'Desinsectación' },
  { id: 'DRT', nombre: 'Desratización' },
  { id: 'LRA', nombre: 'Limpieza de reservorios de agua potable' },
  { id: 'LTG', nombre: 'Limpieza de trampas de grasa' },
  { id: 'LTS', nombre: 'Limpieza de tanques sépticos' },
  { id: 'LAM', nombre: 'Limpieza de ambientes' },
];

export const FRECUENCIAS: Array<{ codigo: FrecuenciaServicio; etiqueta: string }> = [
  { codigo: 'DIARIA', etiqueta: 'Diaria' },
  { codigo: 'SEMANAL', etiqueta: 'Semanal' },
  { codigo: 'QUINCENAL', etiqueta: 'Quincenal' },
  { codigo: 'MENSUAL', etiqueta: 'Mensual' },
  { codigo: 'BIMESTRAL', etiqueta: 'Bimestral' },
  { codigo: 'TRIMESTRAL', etiqueta: 'Trimestral' },
  { codigo: 'SEMESTRAL', etiqueta: 'Semestral' },
  { codigo: 'ANUAL', etiqueta: 'Anual' },
  { codigo: 'PUNTUAL', etiqueta: 'Puntual' },
];

export const ETIQUETA_ESTADO: Record<EstadoActivoInactivo, string> = { ACTIVO: 'Activo', INACTIVO: 'Inactivo' };

/** Estado del trabajo del servicio (GAF-99), con el color de su insignia. */
export const ESTADOS_TRABAJO: Array<{ codigo: EstadoTrabajo; etiqueta: string; color: ColorAura }> = [
  { codigo: 'PENDIENTE', etiqueta: 'Pendiente', color: 'SIN_COLOR' },
  { codigo: 'EN_CURSO', etiqueta: 'En curso', color: 'AMARILLO' },
  { codigo: 'COMPLETADO', etiqueta: 'Completado', color: 'VERDE' },
  { codigo: 'CANCELADO', etiqueta: 'Cancelado', color: 'ROJO' },
];

export function etiquetaEstadoTrabajo(codigo: EstadoTrabajo): string {
  return ESTADOS_TRABAJO.find((e) => e.codigo === codigo)?.etiqueta ?? codigo;
}

export function colorEstadoTrabajo(codigo: EstadoTrabajo): ColorAura {
  return ESTADOS_TRABAJO.find((e) => e.codigo === codigo)?.color ?? 'SIN_COLOR';
}

export function etiquetaFrecuencia(codigo: FrecuenciaServicio): string {
  return FRECUENCIAS.find((f) => f.codigo === codigo)?.etiqueta ?? codigo;
}

export function etiquetaTipoServicio(id: TipoServicio): string {
  const tipo = TIPOS_SERVICIO.find((t) => t.id === id);
  return tipo ? `${tipo.id} — ${tipo.nombre}` : id;
}
