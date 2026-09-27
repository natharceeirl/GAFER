import { describe, expect, it } from 'vitest';
import { EstacionSchema } from './estacion';

const valida = {
  id: '11111111-1111-1111-1111-111111111111',
  numero: 12,
  tipoEstacion: 'CEBO_RATICIDA',
  colorIcono: 'ROJO',
  colorAura: 'VERDE',
} as const;

describe('EstacionSchema', () => {
  it('acepta una estación válida con aura VERDE', () => {
    expect(EstacionSchema.safeParse(valida).success).toBe(true);
  });

  it('rechaza un colorAura fuera del dominio conocido', () => {
    expect(EstacionSchema.safeParse({ ...valida, colorAura: 'AZUL' }).success).toBe(false);
  });

  it('rechaza número de estación negativo', () => {
    expect(EstacionSchema.safeParse({ ...valida, numero: -1, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' }).success).toBe(false);
  });

  it('acepta cebo raticida (círculo) y otra trampa (cuadrado)', () => {
    expect(EstacionSchema.safeParse({ ...valida, tipoEstacion: 'CEBO_RATICIDA' }).success).toBe(true);
    expect(EstacionSchema.safeParse({ ...valida, tipoEstacion: 'TRAMPA_MECANICA' }).success).toBe(true);
  });

  it('rechaza una estación sin tipo o con un tipo desconocido', () => {
    const { tipoEstacion: _omitido, ...sinTipo } = valida;
    expect(EstacionSchema.safeParse(sinTipo).success).toBe(false);
    expect(EstacionSchema.safeParse({ ...valida, tipoEstacion: 'PEGAMENTO' }).success).toBe(false);
  });
});
