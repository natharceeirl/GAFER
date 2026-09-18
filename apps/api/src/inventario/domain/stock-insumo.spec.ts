import { StockInsumo } from './stock-insumo';

describe('StockInsumo', () => {
  it('descuenta correctamente una cantidad usada en un servicio', () => {
    const stock = new StockInsumo('insumo-1', 100, 10);
    stock.descontar(15);
    expect(stock.getCantidadDisponible()).toBe(85);
  });

  it('no permite descontar más de lo disponible', () => {
    const stock = new StockInsumo('insumo-1', 10, 5);
    expect(() => stock.descontar(20)).toThrow(/Stock insuficiente/);
  });

  it('alerta cuando la cantidad llega al umbral mínimo', () => {
    const stock = new StockInsumo('insumo-1', 12, 10);
    expect(stock.necesitaAlerta()).toBe(false);
    stock.descontar(2);
    expect(stock.getCantidadDisponible()).toBe(10);
    expect(stock.necesitaAlerta()).toBe(true);
  });
});
