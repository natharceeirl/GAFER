import { describe, expect, it } from 'vitest';
import { agregarAlFinal, quitarItem, reemplazarItem, validarItem } from './catalogo-texto';

describe('validarItem', () => {
  it('acepta un texto nuevo', () => {
    expect(validarItem('Nidos activos', ['Roedores vivos'])).toBeNull();
  });

  it('rechaza un texto vacío', () => {
    expect(validarItem('   ', [])).toBe('Escriba el texto que desea agregar.');
  });

  it('rechaza un texto que ya está, sin distinguir mayúsculas ni espacios', () => {
    expect(validarItem('  roedores VIVOS ', ['Roedores vivos'])).toBe('Ese texto ya está en el catálogo.');
  });
});

describe('edición de la lista de un catálogo', () => {
  const items = ['A', 'B', 'C'];

  it('reemplaza un texto en su lugar, sin mover los demás', () => {
    expect(reemplazarItem(items, 1, ' B2 ')).toEqual(['A', 'B2', 'C']);
  });

  it('quita un texto por su posición', () => {
    expect(quitarItem(items, 0)).toEqual(['B', 'C']);
  });

  it('agrega al final', () => {
    expect(agregarAlFinal(items, ' D ')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('no modifican la lista original', () => {
    reemplazarItem(items, 0, 'X');
    quitarItem(items, 0);
    agregarAlFinal(items, 'Y');
    expect(items).toEqual(['A', 'B', 'C']);
  });
});
