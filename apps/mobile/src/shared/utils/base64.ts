/**
 * GAFER Mobile — Utilidades Base64 y UTF-8 sin dependencias de Node.js (compatible con Hermes, Web y Node).
 */

const ALFABETO_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const TABLA_DECODIFICACION = (() => {
  const tabla = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALFABETO_BASE64.length; i += 1) {
    tabla[ALFABETO_BASE64.charCodeAt(i)] = i;
  }
  return tabla;
})();

export interface DataUriBase64 {
  mimeType?: string;
  base64: string;
}

/**
 * Extrae el tipo MIME (si existe) y el cuerpo Base64 de un Data URI o cadena Base64 pura.
 */
export function extraerDataUriBase64(valor: string): DataUriBase64 {
  const limpio = valor.trim();
  const match = limpio.match(/^data:([^;]+);base64,([\s\S]*)$/i);
  if (match) {
    return {
      mimeType: match[1].trim().toLowerCase(),
      base64: match[2].replace(/\s+/g, ''),
    };
  }
  return {
    base64: limpio.replace(/\s+/g, ''),
  };
}

/**
 * Codifica un Uint8Array en una cadena Base64 estándar sin usar el global Node `Buffer`.
 */
export function bytesABase64(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) return '';

  const partes: string[] = [];
  const tamanoBloque = 24_576; // múltiplo de 3 para evitar concatenaciones gigantes

  for (let inicio = 0; inicio < bytes.byteLength; inicio += tamanoBloque) {
    const fin = Math.min(inicio + tamanoBloque, bytes.byteLength);
    let salida = '';

    for (let i = inicio; i < fin; i += 3) {
      const b0 = bytes[i];
      const tieneB1 = i + 1 < fin;
      const tieneB2 = i + 2 < fin;
      const b1 = tieneB1 ? bytes[i + 1] : 0;
      const b2 = tieneB2 ? bytes[i + 2] : 0;

      const triple = (b0 << 16) | (b1 << 8) | b2;
      salida +=
        ALFABETO_BASE64[(triple >> 18) & 0x3f] +
        ALFABETO_BASE64[(triple >> 12) & 0x3f] +
        (tieneB1 ? ALFABETO_BASE64[(triple >> 6) & 0x3f] : '=') +
        (tieneB2 ? ALFABETO_BASE64[triple & 0x3f] : '=');
    }

    partes.push(salida);
  }

  return partes.join('');
}

/**
 * Decodifica una cadena Base64 (o Data URI Base64) a Uint8Array sin usar el global Node `Buffer`.
 * Lanza un error si la cadena contiene caracteres o longitud inválidos.
 */
export function base64ABytes(entrada: string): Uint8Array {
  const { base64 } = extraerDataUriBase64(entrada);
  if (base64.length === 0) {
    return new Uint8Array(0);
  }
  if (base64.length % 4 !== 0) {
    throw new Error('Cadena Base64 inválida: longitud no múltiplo de 4.');
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const longitudBytes = (base64.length / 4) * 3 - padding;
  const salida = new Uint8Array(longitudBytes);

  let pos = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const code0 = base64.charCodeAt(i);
    const code1 = base64.charCodeAt(i + 1);
    const code2 = base64.charCodeAt(i + 2);
    const code3 = base64.charCodeAt(i + 3);

    const esPad2 = code2 === 61; // '='
    const esPad3 = code3 === 61; // '='

    if (esPad2 && !esPad3) {
      throw new Error('Cadena Base64 inválida: relleno inconsistente.');
    }
    if ((esPad2 || esPad3) && i + 4 < base64.length) {
      throw new Error('Cadena Base64 inválida: relleno fuera del bloque final.');
    }

    const c0 = code0 < 128 ? TABLA_DECODIFICACION[code0] : -1;
    const c1 = code1 < 128 ? TABLA_DECODIFICACION[code1] : -1;
    const c2 = esPad2 ? 0 : code2 < 128 ? TABLA_DECODIFICACION[code2] : -1;
    const c3 = esPad3 ? 0 : code3 < 128 ? TABLA_DECODIFICACION[code3] : -1;

    if (c0 < 0 || c1 < 0 || (!esPad2 && c2 < 0) || (!esPad3 && c3 < 0)) {
      throw new Error('Cadena Base64 inválida: carácter no permitido.');
    }

    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    salida[pos++] = (triple >> 16) & 0xff;
    if (!esPad2) salida[pos++] = (triple >> 8) & 0xff;
    if (!esPad3) salida[pos++] = triple & 0xff;
  }

  return salida;
}

/**
 * Codifica texto UTF-8 a bytes (compatible con Hermes incluso si TextEncoder no está disponible).
 */
export function textoAUtf8Bytes(texto: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(texto);
  }
  const bytes: number[] = [];
  for (let i = 0; i < texto.length; i += 1) {
    const code = texto.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < texto.length) {
      const siguiente = texto.charCodeAt(i + 1);
      if (siguiente >= 0xdc00 && siguiente <= 0xdfff) {
        const cp = 0x10000 + ((code - 0xd800) << 10) + (siguiente - 0xdc00);
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f),
        );
        i += 1;
        continue;
      }
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Decodifica bytes UTF-8 a cadena de texto (compatible con Hermes/Web/Node).
 */
export function utf8BytesATexto(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let resultado = '';
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      resultado += String.fromCharCode(b0);
      i += 1;
    } else if ((b0 & 0xe0) === 0xc0 && i + 1 < bytes.length) {
      resultado += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((b0 & 0xf0) === 0xe0 && i + 2 < bytes.length) {
      resultado += String.fromCharCode(
        ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else if ((b0 & 0xf8) === 0xf0 && i + 3 < bytes.length) {
      const cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      const offset = cp - 0x10000;
      resultado += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
      i += 4;
    } else {
      i += 1;
    }
  }
  return resultado;
}
