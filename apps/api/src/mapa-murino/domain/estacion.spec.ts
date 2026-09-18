import { ColorAura, Estacion } from './estacion';

describe('Estacion - FSM de aura de tendencia', () => {
  it('primera inspección con consumo pasa de SIN_COLOR a VERDE, e ícono a ROJO', () => {
    const estacion = new Estacion('e1', 1);
    estacion.registrarInspeccion(true);
    expect(estacion.getColorAura()).toBe('VERDE');
    expect(estacion.getColorIcono()).toBe('ROJO');
  });

  it('sin consumo en la primera visita, se mantiene SIN_COLOR e ícono VERDE', () => {
    const estacion = new Estacion('e0', 0);
    estacion.registrarInspeccion(false);
    expect(estacion.getColorAura()).toBe('SIN_COLOR');
    expect(estacion.getColorIcono()).toBe('VERDE');
  });

  it('escala consecutivamente hasta ROJO con consumo sostenido (4 visitas)', () => {
    const estacion = new Estacion('e2', 2);
    estacion.registrarInspeccion(true); // VERDE
    estacion.registrarInspeccion(true); // AMARILLO
    estacion.registrarInspeccion(true); // NARANJA
    estacion.registrarInspeccion(true); // ROJO
    expect(estacion.getColorAura()).toBe('ROJO');
  });

  it('ROJO con consumo adicional se mantiene en ROJO (no hay nivel superior)', () => {
    const estacion = new Estacion('e2b', 2);
    for (let i = 0; i < 6; i += 1) {
      estacion.registrarInspeccion(true);
    }
    expect(estacion.getColorAura()).toBe('ROJO');
  });

  it('desescala exactamente un nivel por visita sin consumo, hasta desaparecer', () => {
    const estacion = new Estacion('e3', 3);
    [true, true, true, true].forEach((c) => estacion.registrarInspeccion(c)); // ROJO
    estacion.registrarInspeccion(false);
    expect(estacion.getColorAura()).toBe('NARANJA');
    estacion.registrarInspeccion(false);
    expect(estacion.getColorAura()).toBe('AMARILLO');
    estacion.registrarInspeccion(false);
    expect(estacion.getColorAura()).toBe('VERDE');
    estacion.registrarInspeccion(false);
    expect(estacion.getColorAura()).toBe('SIN_COLOR');
  });

  it('nunca salta más de un nivel por inspección, en ningún sentido', () => {
    const estacion = new Estacion('e4', 4);
    const orden: ColorAura[] = ['SIN_COLOR', 'VERDE', 'AMARILLO', 'NARANJA', 'ROJO'];
    let anterior = orden.indexOf(estacion.getColorAura());
    const eventosDeConsumo = [true, true, false, true, false, false, true, true, true, true, false];

    for (const huboConsumo of eventosDeConsumo) {
      estacion.registrarInspeccion(huboConsumo);
      const actual = orden.indexOf(estacion.getColorAura());
      expect(Math.abs(actual - anterior)).toBeLessThanOrEqual(1);
      anterior = actual;
    }
  });

  it('SIN_COLOR sin consumo permanece en SIN_COLOR (no hay nivel inferior)', () => {
    const estacion = new Estacion('e5', 5);
    estacion.registrarInspeccion(false);
    estacion.registrarInspeccion(false);
    expect(estacion.getColorAura()).toBe('SIN_COLOR');
  });
});
