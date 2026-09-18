import type { ColorAura } from '@gafer/contracts';

const CLASSNAME_POR_COLOR: Record<ColorAura, string> = {
  SIN_COLOR: 'badge badge--sin-color',
  VERDE: 'badge badge--verde',
  AMARILLO: 'badge badge--amarillo',
  NARANJA: 'badge badge--naranja',
  ROJO: 'badge badge--rojo',
};

export function colorAuraToClassName(color: ColorAura): string {
  return CLASSNAME_POR_COLOR[color];
}
