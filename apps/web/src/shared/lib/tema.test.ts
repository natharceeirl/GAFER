import { describe, expect, it } from 'vitest';
import { atributoTema, opuesto, temaEfectivo } from './tema';

describe('tema claro/oscuro', () => {
  it('sin elección manual sigue al sistema operativo', () => {
    expect(temaEfectivo(null, 'oscuro')).toBe('oscuro');
    expect(temaEfectivo(null, 'claro')).toBe('claro');
  });

  it('la elección manual gana sobre el sistema', () => {
    expect(temaEfectivo('claro', 'oscuro')).toBe('claro');
    expect(temaEfectivo('oscuro', 'claro')).toBe('oscuro');
  });

  it('el botón cambia al tema opuesto', () => {
    expect(opuesto('claro')).toBe('oscuro');
    expect(opuesto('oscuro')).toBe('claro');
  });

  it('se traduce al atributo data-theme que leen los tokens', () => {
    expect(atributoTema('claro')).toBe('light');
    expect(atributoTema('oscuro')).toBe('dark');
  });
});
