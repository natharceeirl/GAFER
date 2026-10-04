import { generarHashClave, verificarClave } from './clave-hash';

describe('Hash de claves con scrypt', () => {
  it('genera un hash con sal por cada llamada y lo verifica', async () => {
    const hashA = await generarHashClave('clave-de-prueba-1');
    const hashB = await generarHashClave('clave-de-prueba-1');

    expect(hashA).not.toBe(hashB);
    expect(hashA.startsWith('scrypt$')).toBe(true);
    expect(hashA).not.toContain('clave-de-prueba-1');
    expect(await verificarClave('clave-de-prueba-1', hashA)).toBe(true);
    expect(await verificarClave('clave-de-prueba-1', hashB)).toBe(true);
  });

  it('rechaza una clave equivocada o vacía', async () => {
    const hash = await generarHashClave('clave-de-prueba-1');

    expect(await verificarClave('otra-clave-distinta', hash)).toBe(false);
    expect(await verificarClave('', hash)).toBe(false);
  });

  it('rechaza hashes ausentes, mal formados o en formatos heredados sin sal', async () => {
    expect(await verificarClave('clave-de-prueba-1', null)).toBe(false);
    expect(await verificarClave('clave-de-prueba-1', '')).toBe(false);
    expect(await verificarClave('clave-de-prueba-1', 'scrypt$basura')).toBe(false);
    // Una clave guardada en texto plano nunca debe servir como hash.
    expect(await verificarClave('clave-de-prueba-1', 'clave-de-prueba-1')).toBe(false);
  });

  it('rechaza parámetros de costo fuera de rango (hash manipulado)', async () => {
    const hash = await generarHashClave('clave-de-prueba-1');
    const partes = hash.split('$');
    partes[1] = String(2 ** 30);
    expect(await verificarClave('clave-de-prueba-1', partes.join('$'))).toBe(false);
  });
});
