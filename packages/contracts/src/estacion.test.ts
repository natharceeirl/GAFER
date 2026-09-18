import { describe, expect, it } from 'vitest';
import { EstacionSchema } from './estacion';

describe('EstacionSchema', () => {
  it('acepta una estación válida con aura VERDE', () => {
    const resultado = EstacionSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      numero: 12,
      colorIcono: 'ROJO',
      colorAura: 'VERDE',
    });
    expect(resultado.success).toBe(true);
  });

  it('rechaza un colorAura fuera del dominio conocido', () => {
    const resultado = EstacionSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      numero: 12,
      colorIcono: 'ROJO',
      colorAura: 'AZUL',
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza número de estación negativo', () => {
    const resultado = EstacionSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      numero: -1,
      colorIcono: 'VERDE',
      colorAura: 'SIN_COLOR',
    });
    expect(resultado.success).toBe(false);
  });
});
