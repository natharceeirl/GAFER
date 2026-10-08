import { ORDEN_LIMPIEZA, ORDEN_SIEMBRA } from './sembrar-demo';

describe('Orden del seed de datos de ejemplo', () => {
  const posicion = (orden: readonly string[], entidad: string) => orden.indexOf(entidad);

  it('siembra primero lo que los demás referencian: clientes antes que sedes, sedes antes que servicios', () => {
    expect(posicion(ORDEN_SIEMBRA, 'clientes')).toBeLessThan(posicion(ORDEN_SIEMBRA, 'sedes'));
    expect(posicion(ORDEN_SIEMBRA, 'sedes')).toBeLessThan(posicion(ORDEN_SIEMBRA, 'servicios'));
    expect(posicion(ORDEN_SIEMBRA, 'insumos')).toBeLessThan(posicion(ORDEN_SIEMBRA, 'servicios'));
    expect(posicion(ORDEN_SIEMBRA, 'equipos')).toBeLessThan(posicion(ORDEN_SIEMBRA, 'servicios'));
  });

  it('limpia en el orden de dependencias: servicios, luego sedes, luego clientes; insumos y equipos después de los servicios', () => {
    expect(posicion(ORDEN_LIMPIEZA, 'servicios')).toBeLessThan(posicion(ORDEN_LIMPIEZA, 'sedes'));
    expect(posicion(ORDEN_LIMPIEZA, 'sedes')).toBeLessThan(posicion(ORDEN_LIMPIEZA, 'clientes'));
    expect(posicion(ORDEN_LIMPIEZA, 'servicios')).toBeLessThan(posicion(ORDEN_LIMPIEZA, 'insumos'));
    expect(posicion(ORDEN_LIMPIEZA, 'servicios')).toBeLessThan(posicion(ORDEN_LIMPIEZA, 'equipos'));
  });

  it('la limpieza recorre exactamente las mismas entidades que la siembra, al revés', () => {
    expect([...ORDEN_LIMPIEZA]).toEqual([...ORDEN_SIEMBRA].reverse());
  });
});
