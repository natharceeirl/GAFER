import { describe, expect, it } from 'vitest';
import { colorAuraToClassName } from './colorAuraToClassName';

describe('colorAuraToClassName', () => {
  it('mapea ROJO a la clase de alerta', () => {
    expect(colorAuraToClassName('ROJO')).toContain('badge--rojo');
  });

  it('mapea SIN_COLOR a la clase neutra', () => {
    expect(colorAuraToClassName('SIN_COLOR')).toContain('badge--sin-color');
  });

  it('devuelve una clase distinta para cada color', () => {
    const colores = ['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO'] as const;
    const clases = new Set(colores.map(colorAuraToClassName));
    expect(clases.size).toBe(colores.length);
  });
});
