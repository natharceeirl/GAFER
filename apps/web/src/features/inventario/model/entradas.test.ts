import { describe, expect, it } from 'vitest';
import { puedeRegistrarEntradas, registrarEntrada, validarEntrada, type DatosEntrada } from './entradas';
import type { StockInsumo } from './tipos';

const stock: StockInsumo[] = [
  { id: 's1', producto: 'Brodifacoum 0.005% bloque parafinado', lote: 'L-2451', cantidadActual: 4.2, unidad: 'kg', umbralMinimo: 5, ultimaActualizacion: '2026-09-17' },
];

const entrada: DatosEntrada = { stockId: 's1', lote: 'L-2451', cantidad: '10', fecha: '2026-09-23', proveedor: 'Química Suiza' };

describe('permisos de inventario (decisión C5)', () => {
  it('solo el Administrador registra compras y entradas; el Supervisor consulta', () => {
    expect(puedeRegistrarEntradas('ADMINISTRADOR')).toBe(true);
    expect(puedeRegistrarEntradas('SUPERVISOR')).toBe(false);
  });
});

describe('validarEntrada', () => {
  it('acepta una entrada completa', () => {
    expect(validarEntrada(entrada)).toEqual({});
  });

  it('exige producto, lote, cantidad positiva, fecha y proveedor', () => {
    const e = validarEntrada({ stockId: '', lote: ' ', cantidad: '0', fecha: '', proveedor: '' });
    expect(Object.keys(e).sort()).toEqual(['cantidad', 'fecha', 'lote', 'proveedor', 'stockId']);
  });
});

describe('registrarEntrada', () => {
  it('suma al mismo lote y actualiza la fecha', () => {
    const [fila] = registrarEntrada(stock, entrada);
    expect(fila.cantidadActual).toBeCloseTo(14.2);
    expect(fila.ultimaActualizacion).toBe('2026-09-23');
  });

  it('un lote nuevo del mismo producto entra como fila aparte, con su umbral', () => {
    const resultado = registrarEntrada(stock, { ...entrada, lote: 'l-2600' });
    expect(resultado).toHaveLength(2);
    expect(resultado[1]).toMatchObject({ producto: stock[0].producto, lote: 'L-2600', cantidadActual: 10, unidad: 'kg', umbralMinimo: 5 });
  });
});
