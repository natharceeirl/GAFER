/**
 * GAFER Mobile — Utilidades de captura y serialización de firma de conformidad (SVG + Base64)
 * Genera data URIs `data:image/svg+xml;base64,...` válidos a partir de trazos táctiles reales
 * sin dependencias nativas externas.
 */

export interface PuntoFirma {
  x: number;
  y: number;
}

export type TrazoFirma = PuntoFirma[];

const ALFABETO_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function textoAUtf8Bytes(texto: string): number[] {
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
  return bytes;
}

/**
 * Codifica una cadena UTF-8 a Base64 estándar (compatible con Hermes, Node y Web).
 */
export function codificarBase64Utf8(texto: string): string {
  const bytes = textoAUtf8Bytes(texto);
  let salida = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const tieneB1 = i + 1 < bytes.length;
    const tieneB2 = i + 2 < bytes.length;
    const b1 = tieneB1 ? bytes[i + 1] : 0;
    const b2 = tieneB2 ? bytes[i + 2] : 0;

    const triple = (b0 << 16) | (b1 << 8) | b2;
    salida += ALFABETO_BASE64[(triple >> 18) & 0x3f];
    salida += ALFABETO_BASE64[(triple >> 12) & 0x3f];
    salida += tieneB1 ? ALFABETO_BASE64[(triple >> 6) & 0x3f] : '=';
    salida += tieneB2 ? ALFABETO_BASE64[triple & 0x3f] : '=';
  }

  return salida;
}

/**
 * Decodifica una cadena Base64 estricta a texto UTF-8; devuelve null si el Base64 es inválido.
 */
export function decodificarBase64Utf8(base64: string): string | null {
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return null;
  }

  const bytes: number[] = [];
  for (let i = 0; i < base64.length; i += 4) {
    const c0 = ALFABETO_BASE64.indexOf(base64[i]);
    const c1 = ALFABETO_BASE64.indexOf(base64[i + 1]);
    const c2 = base64[i + 2] === '=' ? -1 : ALFABETO_BASE64.indexOf(base64[i + 2]);
    const c3 = base64[i + 3] === '=' ? -1 : ALFABETO_BASE64.indexOf(base64[i + 3]);

    if (c0 < 0 || c1 < 0 || (base64[i + 2] !== '=' && c2 < 0) || (base64[i + 3] !== '=' && c3 < 0)) {
      return null;
    }

    const triple = (c0 << 18) | (c1 << 12) | ((c2 >= 0 ? c2 : 0) << 6) | (c3 >= 0 ? c3 : 0);
    bytes.push((triple >> 16) & 0xff);
    if (c2 >= 0) bytes.push((triple >> 8) & 0xff);
    if (c3 >= 0) bytes.push(triple & 0xff);
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
      return null;
    }
  }
  return resultado;
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Comprueba si los trazos contienen al menos un trazo válido con movimiento (>= 2 puntos).
 */
export function tieneTrazosValidos(trazos: TrazoFirma[]): boolean {
  return trazos.some((trazo) => trazo.length >= 2);
}

/**
 * Serializa trazos táctiles reales en un SVG válido codificado en Base64 (`data:image/svg+xml;base64,...`).
 */
export function generarSvgFirmaBase64(
  trazos: TrazoFirma[],
  ancho = 320,
  alto = 160,
): string {
  const trazosValidos = trazos.filter((trazo) => trazo.length >= 2);
  if (trazosValidos.length === 0) {
    throw new Error('Debe dibujar al menos un trazo en el recuadro de firma antes de confirmar.');
  }

  const paths = trazosValidos
    .map((trazo) => {
      const comandos = trazo
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${redondear(p.x)} ${redondear(p.y)}`)
        .join(' ');
      return `<path d="${comandos}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}"><rect width="100%" height="100%" fill="#ffffff"/>${paths}</svg>`;
  return `data:image/svg+xml;base64,${codificarBase64Utf8(svg)}`;
}

const REGEX_FIRMA_DATA_URI = /^data:image\/(svg\+xml|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Valida que la firma almacenada sea un data URI de imagen con Base64 válido
 * (y si es SVG, que contenga un documento `<svg>` con al menos un `<path>`).
 */
export function esFirmaDataUriValida(firma: string | null | undefined): boolean {
  if (!firma || typeof firma !== 'string') return false;
  const match = firma.trim().match(REGEX_FIRMA_DATA_URI);
  if (!match) return false;

  const tipo = match[1];
  const base64 = match[2];
  if (base64.length === 0 || base64.length % 4 !== 0) return false;

  if (tipo === 'svg+xml') {
    const svg = decodificarBase64Utf8(base64);
    if (!svg) return false;
    return svg.includes('<svg') && svg.includes('<path');
  }

  return true;
}
