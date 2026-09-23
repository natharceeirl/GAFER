import type { TipoServicio } from '@gafer/contracts';

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

export const FRECUENCIAS = ['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual', 'Puntual'];

export function etiquetaTipoServicio(id: TipoServicio): string {
  const tipo = TIPOS_SERVICIO.find((t) => t.id === id);
  return tipo ? `${tipo.id} — ${tipo.nombre}` : id;
}
