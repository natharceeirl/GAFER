/**
 * Las firmas gráficas se guardan como data URL (`data:image/png;base64,...`) o como clave de un objeto en el
 * almacenamiento de archivos (decisión C7). El PDF solo dibuja PNG y JPEG: cualquier otra cosa se descarta
 * antes de llegar al renderizador, para que una firma corrupta nunca tumbe el PDF ni se invente otra.
 */

export type FirmaInterpretada = { tipo: 'imagen'; bytes: Buffer } | { tipo: 'clave'; clave: string };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

/** ¿Los primeros bytes son los de un PNG o un JPEG? */
export function esImagenFirma(bytes: Buffer): boolean {
  return bytes.subarray(0, PNG.length).equals(PNG) || bytes.subarray(0, JPEG.length).equals(JPEG);
}

/** `null` si no hay firma utilizable; imagen ya decodificada o clave por resolver en el almacenamiento. */
export function interpretarFirma(valor: string | null | undefined): FirmaInterpretada | null {
  const texto = valor?.trim();
  if (!texto) return null;
  if (texto.startsWith('data:')) {
    const partes = DATA_URL.exec(texto);
    if (!partes || !['image/png', 'image/jpeg'].includes(partes[1])) return null;
    const bytes = Buffer.from(partes[2], 'base64');
    return esImagenFirma(bytes) ? { tipo: 'imagen', bytes } : null;
  }
  return { tipo: 'clave', clave: texto };
}
