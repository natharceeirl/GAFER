import { describe, expect, it } from 'vitest';
import { esClienteDeEjemplo, estadoInicialCartera, proyectosDe, sedesActivas } from './cartera';

/** Un cliente del API: su id no está entre los de ejemplo. */
const CLIENTE_API = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';

describe('cartera de ejemplo (programación, tablero y mapa murino)', () => {
  it('un cliente de ejemplo trae las sedes de ejemplo; uno del API no tiene sedes aquí', () => {
    const inicial = estadoInicialCartera();
    expect(esClienteDeEjemplo(inicial, inicial.clientes[0].id)).toBe(true);
    expect(proyectosDe(inicial, inicial.clientes[0].id).length).toBeGreaterThan(0);

    expect(esClienteDeEjemplo(inicial, CLIENTE_API)).toBe(false);
    expect(proyectosDe(inicial, CLIENTE_API)).toEqual([]);
  });

  it('lista solo sedes activas de clientes activos, para que el técnico elija (§3)', () => {
    const inicial = estadoInicialCartera();
    const sedes = sedesActivas(inicial);
    expect(sedes.length).toBeGreaterThan(0);
    expect(sedes.every((s) => s.cliente.estado === 'ACTIVO' && s.proyecto.estado === 'ACTIVO')).toBe(true);
  });
});
