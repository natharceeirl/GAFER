import { Cliente } from './cliente';

describe('Cliente', () => {
  it('crea un cliente ACTIVO por defecto con código corto válido', () => {
    const cliente = new Cliente('c1', 'KALLPA', 'Kallpa S.A.C.');
    expect(cliente.getEstado()).toBe('ACTIVO');
  });

  it('rechaza un código corto en minúsculas', () => {
    expect(() => new Cliente('c1', 'kallpa', 'Kallpa S.A.C.')).toThrow();
  });

  it('rechaza un código corto de menos de 4 caracteres', () => {
    expect(() => new Cliente('c1', 'AB', 'Kallpa S.A.C.')).toThrow();
  });

  it('permite desactivar sin borrar el historial (solo cambia estado)', () => {
    const cliente = new Cliente('c1', 'KALLPA', 'Kallpa S.A.C.');
    cliente.desactivar();
    expect(cliente.getEstado()).toBe('INACTIVO');
  });
});
