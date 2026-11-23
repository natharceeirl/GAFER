/**
 * GAFER Mobile — Compresión y Procesamiento de Fotografías (§13.1, Decisión C15)
 *
 * Reglas innegociables:
 * - Las fotos se comprimen localmente a un máximo de 1 MB (1,048,576 bytes) mediante
 *   decodificación y recompresión real (expo-image-manipulator), NUNCA submuestreando bytes crudos.
 * - El hash SHA-256 se calcula con un proveedor criptográfico real (expo-crypto en nativo,
 *   WebCrypto/crypto.subtle en Node/Web), NUNCA con degradación a hash no criptográfico.
 * - Sin uso del global Node.js `Buffer` (compatible con Hermes).
 */

import {
  base64ABytes,
  bytesABase64,
  extraerDataUriBase64,
  textoAUtf8Bytes,
} from '../../../shared/utils/base64';

export const MAX_TAMANO_FOTO_BYTES = 1024 * 1024; // 1 MB exacto

export interface EntradaFoto {
  uri?: string;
  base64?: string;
  buffer?: Uint8Array;
  mimeType?: string;
  nombreOriginal?: string;
}

export interface FotoProcesada {
  base64: string;
  buffer: Uint8Array;
  tamanoBytes: number;
  sha256: string;
  mimeType: string;
  fueComprimida: boolean;
}

export interface SolicitudRecompresionImagen {
  uri?: string;
  bytes?: Uint8Array;
  mimeType: string;
  calidad: number;
  anchoMaximo?: number;
}

export interface ResultadoRecompresionImagen {
  bytes: Uint8Array;
  mimeType: string;
  ancho?: number;
  alto?: number;
}

export interface CompresorImagenPort {
  recomprimir(solicitud: SolicitudRecompresionImagen): Promise<ResultadoRecompresionImagen>;
}

export type CalculadorSha256Port = (bytes: Uint8Array) => Promise<string>;
export type LectorUriBytesPort = (uri: string) => Promise<Uint8Array>;

export interface OpcionesCompresionFoto {
  maxBytes?: number;
  calidadInicial?: number;
  compresor?: CompresorImagenPort;
  leerUriBytes?: LectorUriBytesPort;
}

export interface ExpoImageManipulatorModuleLike {
  ImageManipulator: {
    manipulate(source: string): {
      resize(size: { width?: number | null; height?: number | null }): unknown;
      renderAsync(): Promise<{
        width: number;
        height: number;
        saveAsync(options?: {
          base64?: boolean;
          compress?: number;
          format?: string;
        }): Promise<{ uri: string; width: number; height: number; base64?: string }>;
      }>;
    };
  };
  SaveFormat: {
    JPEG: string;
    PNG: string;
    WEBP: string;
  };
}

export interface ExpoCryptoModuleLike {
  CryptoDigestAlgorithm: {
    SHA256: string;
  };
  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
}

function esEntornoNativo(): boolean {
  if (typeof process !== 'undefined' && process.versions?.node) {
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    return Platform?.OS === 'android' || Platform?.OS === 'ios';
  } catch {
    return false;
  }
}

function arrayBufferAHex(buffer: ArrayBuffer): string {
  const arr = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < arr.length; i += 1) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function cargarModuloExpoCrypto(): ExpoCryptoModuleLike {
  // Referencia estática literal obligatoria para Metro.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-crypto') as ExpoCryptoModuleLike;
}

function cargarModuloExpoImageManipulator(): ExpoImageManipulatorModuleLike {
  // Referencia estática literal obligatoria para Metro.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-image-manipulator') as ExpoImageManipulatorModuleLike;
}

function cargarModuloExpoFileSystemParaMedia(): {
  File: new (...uris: unknown[]) => {
    exists: boolean;
    create(options?: { intermediates?: boolean; overwrite?: boolean }): void;
    write(content: string | Uint8Array): void;
    bytes(): Promise<Uint8Array>;
    delete(): void;
  };
  Paths: {
    cache: unknown;
  };
} {
  // Referencia estática literal obligatoria para Metro.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-file-system');
}

/**
 * Crea un calculador SHA-256 respaldado por `expo-crypto` (nativo Android/iOS).
 */
export function crearCalculadorSha256Expo(cryptoMod?: ExpoCryptoModuleLike): CalculadorSha256Port {
  const modulo = cryptoMod ?? cargarModuloExpoCrypto();
  return async (bytes: Uint8Array): Promise<string> => {
    const digest = await modulo.digest(modulo.CryptoDigestAlgorithm.SHA256, bytes);
    const hex = arrayBufferAHex(digest);
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      throw new Error('El proveedor expo-crypto devolvió un hash SHA-256 inválido.');
    }
    return hex;
  };
}

let calculadorSha256Personalizado: CalculadorSha256Port | null = null;

export function configurarCalculadorSha256(calculador: CalculadorSha256Port | null): void {
  calculadorSha256Personalizado = calculador;
}

/**
 * Calcula el tamaño en bytes de una cadena en Base64.
 */
export function calcularTamanoBytesBase64(base64: string): number {
  const { base64: limpia } = extraerDataUriBase64(base64);
  if (!limpia) return 0;
  const padding = limpia.endsWith('==') ? 2 : limpia.endsWith('=') ? 1 : 0;
  return Math.floor((limpia.length * 3) / 4) - padding;
}

/**
 * Calcula el hash criptográfico SHA-256 real (64 caracteres hexadecimales minúsculas).
 * En móvil usa `expo-crypto`; en Web/Node usa `crypto.subtle` (o `node:crypto` en Node).
 * Nunca degrada a un hash no criptográfico.
 */
export async function calcularSha256(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? textoAUtf8Bytes(data) : data;

  if (calculadorSha256Personalizado) {
    return calculadorSha256Personalizado(bytes);
  }

  if (esEntornoNativo()) {
    return crearCalculadorSha256Expo()(bytes);
  }

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.digest === 'function') {
    const copia = new Uint8Array(bytes.byteLength);
    copia.set(bytes);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', copia.buffer);
    return arrayBufferAHex(hashBuffer);
  }

  throw new Error(
    'No hay un proveedor criptográfico SHA-256 disponible en este entorno (se requiere expo-crypto o WebCrypto).',
  );
}

/**
 * Compresor real de imágenes respaldado por `expo-image-manipulator` y `expo-file-system`.
 * Decodifica la imagen, normaliza orientación EXIF, redimensiona (si corresponde) y recodifica a JPEG.
 */
export class ExpoImageManipulatorCompresor implements CompresorImagenPort {
  private readonly manipulatorMod?: ExpoImageManipulatorModuleLike;
  private readonly fsMod?: ReturnType<typeof cargarModuloExpoFileSystemParaMedia>;

  constructor(
    manipulatorMod?: ExpoImageManipulatorModuleLike,
    fsMod?: ReturnType<typeof cargarModuloExpoFileSystemParaMedia>,
  ) {
    this.manipulatorMod = manipulatorMod;
    this.fsMod = fsMod;
  }

  async recomprimir(solicitud: SolicitudRecompresionImagen): Promise<ResultadoRecompresionImagen> {
    const manipulator = this.manipulatorMod ?? cargarModuloExpoImageManipulator();
    const fsMod = this.fsMod ?? cargarModuloExpoFileSystemParaMedia();

    let archivoEntradaTemp: ReturnType<typeof this.crearArchivoTemp> | null = null;
    let archivoSalida: InstanceType<typeof fsMod.File> | null = null;

    try {
      let uriOrigen = solicitud.uri;
      if (!uriOrigen) {
        if (!solicitud.bytes || solicitud.bytes.byteLength === 0) {
          throw new Error('Se requiere URI o bytes de imagen para recomprimir.');
        }
        archivoEntradaTemp = this.crearArchivoTemp(fsMod, solicitud.mimeType);
        archivoEntradaTemp.file.create({ intermediates: true, overwrite: true });
        archivoEntradaTemp.file.write(solicitud.bytes);
        uriOrigen = archivoEntradaTemp.uri;
      }

      const contexto = manipulator.ImageManipulator.manipulate(uriOrigen);
      if (solicitud.anchoMaximo && solicitud.anchoMaximo > 0) {
        contexto.resize({ width: solicitud.anchoMaximo });
      }

      const renderizada = await contexto.renderAsync();
      const guardada = await renderizada.saveAsync({
        compress: Math.min(1, Math.max(0.1, solicitud.calidad)),
        format: manipulator.SaveFormat.JPEG,
        base64: false,
      });

      archivoSalida = new fsMod.File(guardada.uri);
      const bytesSalida = new Uint8Array(await archivoSalida.bytes());

      return {
        bytes: bytesSalida,
        mimeType: 'image/jpeg',
        ancho: guardada.width,
        alto: guardada.height,
      };
    } finally {
      try {
        if (archivoEntradaTemp?.file.exists) {
          archivoEntradaTemp.file.delete();
        }
      } catch {
        // Ignorar errores de limpieza en caché temporal.
      }
      try {
        if (archivoSalida?.exists && (!solicitud.uri || archivoSalida !== null)) {
          archivoSalida.delete();
        }
      } catch {
        // Ignorar errores de limpieza en caché temporal.
      }
    }
  }

  private crearArchivoTemp(
    fsMod: ReturnType<typeof cargarModuloExpoFileSystemParaMedia>,
    mimeType: string,
  ): { file: InstanceType<typeof fsMod.File>; uri: string } {
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const nombre = `gafer_recomp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const file = new fsMod.File(fsMod.Paths.cache, nombre);
    const uri = (file as unknown as { uri?: string }).uri ?? `file:///cache/${nombre}`;
    return { file, uri };
  }
}

let compresorPorDefecto: CompresorImagenPort | null = null;
let lectorUriPorDefecto: LectorUriBytesPort | null = null;

export function configurarCompresorImagen(compresor: CompresorImagenPort | null): void {
  compresorPorDefecto = compresor;
}

export function obtenerCompresorImagen(): CompresorImagenPort | null {
  if (compresorPorDefecto) {
    return compresorPorDefecto;
  }
  if (esEntornoNativo()) {
    compresorPorDefecto = new ExpoImageManipulatorCompresor();
    return compresorPorDefecto;
  }
  return null;
}

export function configurarLectorUriBytes(lector: LectorUriBytesPort | null): void {
  lectorUriPorDefecto = lector;
}

async function leerBytesDesdeUri(uri: string, lector?: LectorUriBytesPort): Promise<Uint8Array> {
  if (lector) {
    return lector(uri);
  }
  if (lectorUriPorDefecto) {
    return lectorUriPorDefecto(uri);
  }
  if (esEntornoNativo()) {
    const fsMod = cargarModuloExpoFileSystemParaMedia();
    const archivo = new fsMod.File(uri);
    return new Uint8Array(await archivo.bytes());
  }
  throw new Error(`No hay un lector de URI configurado para leer "${uri}" en este entorno.`);
}

/**
 * Genera la ruta relativa canónica para una fotografía según la jerarquía de §5.3.
 */
export function generarRutaFoto(inspectionId: string, fileId: string): string {
  return `inspections/INS_${inspectionId}/photos/PH_${fileId}.jpg`;
}

/**
 * Obtiene la extensión de archivo coherente con el MIME type de una firma.
 */
export function extensionFirmaPorMime(mimeType: string): 'svg' | 'png' | 'jpg' {
  const norm = mimeType.trim().toLowerCase();
  if (norm === 'image/png') return 'png';
  if (norm === 'image/jpeg' || norm === 'image/jpg') return 'jpg';
  return 'svg';
}

/**
 * Genera la ruta relativa canónica para una firma según la jerarquía de §5.3,
 * coherente con el formato real del archivo (por defecto SVG de FirmaPadModal).
 */
export function generarRutaFirma(
  inspectionId: string,
  fileId: string,
  mimeType: string = 'image/svg+xml',
): string {
  const ext = extensionFirmaPorMime(mimeType);
  return `inspections/INS_${inspectionId}/signatures/SIG_${fileId}.${ext}`;
}

interface PasoCompresion {
  calidad: number;
  anchoMaximo?: number;
}

function construirPasosCompresion(calidadInicial: number): PasoCompresion[] {
  const c0 = Math.min(1, Math.max(0.2, Math.round(calidadInicial * 100) / 100));
  const c1 = Math.max(0.2, Math.round(c0 * 0.8 * 100) / 100);
  const c2 = Math.max(0.2, Math.round(Math.min(c1 * 0.85, 0.65) * 100) / 100);
  const c3 = Math.max(0.2, Math.round(Math.min(c2 * 0.8, 0.5) * 100) / 100);
  const c4 = Math.max(0.2, Math.round(Math.min(c3 * 0.75, 0.35) * 100) / 100);
  const c5 = 0.25;

  return [
    { calidad: c0 },
    { calidad: c1, anchoMaximo: 1920 },
    { calidad: c2, anchoMaximo: 1600 },
    { calidad: c3, anchoMaximo: 1280 },
    { calidad: c4, anchoMaximo: 1024 },
    { calidad: c5, anchoMaximo: 800 },
  ];
}

/**
 * Procesa y comprime una fotografía garantizando que su tamaño en disco sea <= 1 MB (Decisión C15).
 * - Si la foto ya cumple con el límite, se conserva intacta.
 * - Si excede 1 MB, decodifica y recomprime iterativamente mediante `CompresorImagenPort`
 *   (respaldado por `expo-image-manipulator` en Android/iOS), respetando `calidadInicial`.
 * - Nunca trunca ni submuestrea bytes crudos.
 */
export async function comprimirFoto(
  entrada: EntradaFoto | Uint8Array | string,
  opcionesOBytes?: number | OpcionesCompresionFoto,
): Promise<FotoProcesada> {
  let bytes: Uint8Array | undefined;
  let uriOrigen: string | undefined;
  let mimeType = 'image/jpeg';
  let maxBytes = MAX_TAMANO_FOTO_BYTES;
  let calidadInicial = 0.8;
  let compresorOpcional: CompresorImagenPort | undefined;
  let lectorUriOpcional: LectorUriBytesPort | undefined;

  if (typeof opcionesOBytes === 'number') {
    maxBytes = opcionesOBytes;
  } else if (opcionesOBytes && typeof opcionesOBytes === 'object') {
    if (typeof opcionesOBytes.maxBytes === 'number') {
      maxBytes = opcionesOBytes.maxBytes;
    }
    if (typeof opcionesOBytes.calidadInicial === 'number') {
      calidadInicial = opcionesOBytes.calidadInicial;
    }
    compresorOpcional = opcionesOBytes.compresor;
    lectorUriOpcional = opcionesOBytes.leerUriBytes;
  }

  if (entrada instanceof Uint8Array) {
    bytes = entrada;
  } else if (typeof entrada === 'string') {
    const extraido = extraerDataUriBase64(entrada);
    if (extraido.mimeType) mimeType = extraido.mimeType;
    bytes = base64ABytes(extraido.base64);
  } else if (entrada && typeof entrada === 'object') {
    if (entrada.mimeType) mimeType = entrada.mimeType;
    if (entrada.uri) uriOrigen = entrada.uri;
    if (entrada.buffer) {
      bytes = entrada.buffer;
    } else if (entrada.base64) {
      const extraido = extraerDataUriBase64(entrada.base64);
      if (!entrada.mimeType && extraido.mimeType) mimeType = extraido.mimeType;
      bytes = base64ABytes(extraido.base64);
    } else if (entrada.uri) {
      bytes = await leerBytesDesdeUri(entrada.uri, lectorUriOpcional);
    } else {
      throw new Error('Debe proporcionar uri, buffer o base64 para procesar la fotografía');
    }
  } else {
    throw new Error('Debe proporcionar uri, buffer o base64 para procesar la fotografía');
  }

  if (!bytes || bytes.byteLength === 0) {
    throw new Error('La fotografía está vacía y no puede procesarse.');
  }

  let fueComprimida = false;

  if (bytes.byteLength > maxBytes) {
    const compresor = compresorOpcional ?? obtenerCompresorImagen();
    if (!compresor) {
      throw new Error(
        'No hay un compresor de imágenes real disponible para reducir una fotografía que supera el límite de 1 MB (Decisión C15).',
      );
    }

    const pasos = construirPasosCompresion(calidadInicial);
    let resultadoAjustado: ResultadoRecompresionImagen | null = null;
    let ultimoTamano = bytes.byteLength;

    for (const paso of pasos) {
      const intento = await compresor.recomprimir({
        uri: uriOrigen,
        bytes,
        mimeType,
        calidad: paso.calidad,
        anchoMaximo: paso.anchoMaximo,
      });

      ultimoTamano = intento.bytes.byteLength;
      if (ultimoTamano > 0 && ultimoTamano <= maxBytes) {
        resultadoAjustado = intento;
        break;
      }
    }

    if (!resultadoAjustado) {
      throw new Error(
        `La fotografía excede el tamaño máximo permitido de 1 MB incluso tras recomprimir (${ultimoTamano} > ${maxBytes} bytes, Decisión C15).`,
      );
    }

    bytes = resultadoAjustado.bytes;
    mimeType = resultadoAjustado.mimeType || 'image/jpeg';
    fueComprimida = true;
  }

  if (bytes.byteLength > maxBytes) {
    throw new Error(
      `La fotografía excede el tamaño máximo permitido de 1 MB (${bytes.byteLength} > ${maxBytes} bytes).`,
    );
  }

  const base64Final = bytesABase64(bytes);
  const sha256 = await calcularSha256(bytes);

  return {
    base64: base64Final,
    buffer: bytes,
    tamanoBytes: bytes.byteLength,
    sha256,
    mimeType,
    fueComprimida,
  };
}

/**
 * Valida si un tamaño en bytes cumple la cuota C15.
 */
export function validarTamanoC15(tamanoBytes: number): boolean {
  return tamanoBytes > 0 && tamanoBytes <= MAX_TAMANO_FOTO_BYTES;
}
