import * as crypto from 'crypto';

/**
 * Hash de claves con scrypt (módulo `crypto` de Node, sin dependencias nativas).
 * Formato guardado en `personal.clave_hash`: `scrypt$N$r$p$sal$hash` (sal y hash en base64).
 * Los parámetros viajan en el propio hash, así que se pueden subir sin invalidar claves existentes.
 */
const COSTO_N = 2 ** 15;
const BLOQUES_R = 8;
const PARALELISMO_P = 1;
const LARGO_SAL = 16;
const LARGO_HASH = 64;
const MEMORIA_MAXIMA = 128 * 1024 * 1024;
// Tope a los parámetros leídos de la base para que un hash manipulado no agote memoria o CPU.
const COSTO_N_MAXIMO = 2 ** 17;
const BLOQUES_R_MAXIMO = 16;
const PARALELISMO_P_MAXIMO = 4;

function derivar(
  clave: string,
  sal: Buffer,
  largo: number,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    crypto.scrypt(clave, sal, largo, { N: n, r, p, maxmem: MEMORIA_MAXIMA }, (error, derivada) =>
      error ? rechazar(error) : resolver(derivada),
    );
  });
}

export async function generarHashClave(clavePlana: string): Promise<string> {
  const sal = crypto.randomBytes(LARGO_SAL);
  const hash = await derivar(clavePlana, sal, LARGO_HASH, COSTO_N, BLOQUES_R, PARALELISMO_P);
  return ['scrypt', COSTO_N, BLOQUES_R, PARALELISMO_P, sal.toString('base64'), hash.toString('base64')].join('$');
}

function esPotenciaDeDos(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 2 && (valor & (valor - 1)) === 0;
}

/** Compara en tiempo constante. Cualquier formato distinto de `scrypt$...` se considera inválido. */
export async function verificarClave(
  clavePlana: string,
  hashGuardado: string | null | undefined,
): Promise<boolean> {
  if (!clavePlana || !hashGuardado) return false;

  const partes = hashGuardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const n = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  if (!esPotenciaDeDos(n) || n > COSTO_N_MAXIMO) return false;
  if (!Number.isInteger(r) || r < 1 || r > BLOQUES_R_MAXIMO) return false;
  if (!Number.isInteger(p) || p < 1 || p > PARALELISMO_P_MAXIMO) return false;

  const sal = Buffer.from(partes[4], 'base64');
  const esperado = Buffer.from(partes[5], 'base64');
  if (sal.length === 0 || esperado.length === 0) return false;

  const calculado = await derivar(clavePlana, sal, esperado.length, n, r, p);
  return crypto.timingSafeEqual(calculado, esperado);
}

let hashFicticio: Promise<string> | undefined;

/**
 * Verifica contra un hash descartable para que un usuario inexistente tarde lo mismo que uno real
 * y el login no revele qué usuarios existen por el tiempo de respuesta.
 */
export async function verificarContraHashFicticio(clavePlana: string): Promise<false> {
  hashFicticio ??= generarHashClave(crypto.randomBytes(24).toString('hex'));
  await verificarClave(clavePlana, await hashFicticio);
  return false;
}
