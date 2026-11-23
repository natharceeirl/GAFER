/**
 * GAFER Mobile — Adaptador de Sistema de Archivos (Filesystem)
 * Almacenamiento local persistente para binarios (fotos, firmas, planos)
 * según Guía Rev 2 (§5.2, §5.3, §13.1.1).
 *
 * En dispositivos móviles (Android/iOS) usa `expo-file-system` sobre `Paths.document`
 * con escritura atómica (archivo temporal -> move con sobrescritura).
 * En Vitest/Node y Web utiliza `MemoryFilesystemAdapter` salvo inyección explícita.
 */

import { base64ABytes, textoAUtf8Bytes, utf8BytesATexto } from '../utils/base64';

export interface FilesystemPort {
  escribir(rutaRelativa: string, datos: string | Uint8Array): Promise<string>;
  leer(rutaRelativa: string): Promise<string>;
  leerBytes(rutaRelativa: string): Promise<Uint8Array>;
  existe(rutaRelativa: string): Promise<boolean>;
  eliminar(rutaRelativa: string): Promise<void>;
  obtenerTamanoBytes(rutaRelativa: string): Promise<number>;
  listar(directorioRelativo?: string): Promise<string[]>;
}

export interface ExpoFileLike {
  readonly uri: string;
  readonly name?: string;
  exists: boolean;
  size: number;
  create(options?: { intermediates?: boolean; overwrite?: boolean }): void;
  write(content: string | Uint8Array): void;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
  delete(): void;
  move(destination: ExpoFileLike, options?: { overwrite?: boolean }): Promise<void>;
}

export interface ExpoDirectoryLike {
  readonly uri: string;
  readonly name?: string;
  exists: boolean;
  create(options?: { intermediates?: boolean; idempotent?: boolean; overwrite?: boolean }): void;
  list(): Array<ExpoDirectoryLike | ExpoFileLike>;
}

export interface ExpoFileSystemModuleLike {
  File: new (...uris: Array<string | ExpoFileLike | ExpoDirectoryLike>) => ExpoFileLike;
  Directory: new (...uris: Array<string | ExpoFileLike | ExpoDirectoryLike>) => ExpoDirectoryLike;
  Paths: {
    document: ExpoDirectoryLike;
    cache: ExpoDirectoryLike;
  };
}

function normalizarYValidarRuta(ruta: string): string {
  const norm = ruta.replace(/^[/\\]+/, '').replace(/\\/g, '/').replace(/\/+/g, '/');
  const segmentos = norm.split('/').filter((s) => s.length > 0);
  if (segmentos.some((s) => s === '.' || s === '..')) {
    throw new Error(`Ruta relativa inválida (traversal no permitido): ${ruta}`);
  }
  return segmentos.join('/');
}

function datosABytes(datos: string | Uint8Array): Uint8Array {
  if (typeof datos !== 'string') {
    return datos;
  }
  if (datos.startsWith('data:') && datos.includes(';base64,')) {
    return base64ABytes(datos);
  }
  return textoAUtf8Bytes(datos);
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

function cargarModuloExpoFileSystem(): ExpoFileSystemModuleLike {
  // Referencia estática literal obligatoria para que Metro incluya expo-file-system en el bundle nativo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-file-system') as ExpoFileSystemModuleLike;
}

function esDirectorio(entrada: ExpoDirectoryLike | ExpoFileLike): entrada is ExpoDirectoryLike {
  return typeof (entrada as ExpoDirectoryLike).list === 'function';
}

/**
 * Adaptador persistente en disco sobre `expo-file-system` (Paths.document).
 * Garantiza persistencia real entre reinicios de la app (§5.2) y escritura atómica
 * mediante archivo temporal + movimiento al destino (§13.1.1).
 */
export class ExpoFilesystemAdapter implements FilesystemPort {
  private readonly fsMod: ExpoFileSystemModuleLike;

  constructor(fsMod?: ExpoFileSystemModuleLike) {
    this.fsMod = fsMod ?? cargarModuloExpoFileSystem();
  }

  private resolverSegmentos(rutaRelativa: string): string[] {
    const norm = normalizarYValidarRuta(rutaRelativa);
    return norm ? norm.split('/') : [];
  }

  private resolverArchivo(rutaRelativa: string): {
    rutaNorm: string;
    segmentos: string[];
    archivo: ExpoFileLike;
    directorioPadre: ExpoDirectoryLike;
    nombreArchivo: string;
  } {
    const rutaNorm = normalizarYValidarRuta(rutaRelativa);
    if (!rutaNorm) {
      throw new Error('Debe indicar una ruta relativa de archivo válida.');
    }
    const segmentos = rutaNorm.split('/');
    const nombreArchivo = segmentos[segmentos.length - 1];
    const segmentosDir = segmentos.slice(0, -1);
    const directorioPadre =
      segmentosDir.length > 0
        ? new this.fsMod.Directory(this.fsMod.Paths.document, ...segmentosDir)
        : this.fsMod.Paths.document;
    const archivo = new this.fsMod.File(directorioPadre, nombreArchivo);
    return { rutaNorm, segmentos, archivo, directorioPadre, nombreArchivo };
  }

  async escribir(rutaRelativa: string, datos: string | Uint8Array): Promise<string> {
    const { rutaNorm, archivo, directorioPadre, nombreArchivo } = this.resolverArchivo(rutaRelativa);
    const bytes = datosABytes(datos);

    if (!directorioPadre.exists) {
      directorioPadre.create({ intermediates: true, idempotent: true });
    }

    // Orden anti-pérdida (§13.1.1): escribir primero en archivo temporal dentro de documentDirectory
    // y luego moverlo de forma atómica al destino final.
    const sufijo = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const archivoTemporal = new this.fsMod.File(directorioPadre, `.tmp_${sufijo}_${nombreArchivo}`);

    try {
      archivoTemporal.create({ intermediates: true, overwrite: true });
      archivoTemporal.write(bytes);
      await archivoTemporal.move(archivo, { overwrite: true });
      return rutaNorm;
    } catch (error) {
      try {
        if (archivoTemporal.exists) {
          archivoTemporal.delete();
        }
      } catch {
        // Preservar el error original de escritura/movimiento.
      }
      throw error;
    }
  }

  async leer(rutaRelativa: string): Promise<string> {
    const { archivo } = this.resolverArchivo(rutaRelativa);
    if (!archivo.exists) {
      throw new Error(`Archivo no encontrado: ${rutaRelativa}`);
    }
    return archivo.text();
  }

  async leerBytes(rutaRelativa: string): Promise<Uint8Array> {
    const { archivo } = this.resolverArchivo(rutaRelativa);
    if (!archivo.exists) {
      throw new Error(`Archivo no encontrado: ${rutaRelativa}`);
    }
    const bytes = await archivo.bytes();
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }

  async existe(rutaRelativa: string): Promise<boolean> {
    const { archivo } = this.resolverArchivo(rutaRelativa);
    return Boolean(archivo.exists);
  }

  async eliminar(rutaRelativa: string): Promise<void> {
    const { archivo } = this.resolverArchivo(rutaRelativa);
    if (archivo.exists) {
      archivo.delete();
    }
  }

  async obtenerTamanoBytes(rutaRelativa: string): Promise<number> {
    const { archivo } = this.resolverArchivo(rutaRelativa);
    return archivo.exists ? Number(archivo.size ?? 0) : 0;
  }

  async listar(directorioRelativo = ''): Promise<string[]> {
    const segmentos = this.resolverSegmentos(directorioRelativo);
    const raiz =
      segmentos.length > 0
        ? new this.fsMod.Directory(this.fsMod.Paths.document, ...segmentos)
        : this.fsMod.Paths.document;

    if (!raiz.exists) {
      return [];
    }

    const prefijo = segmentos.join('/');
    const resultados: string[] = [];

    const recorrer = (dir: ExpoDirectoryLike, rutaActual: string) => {
      for (const entrada of dir.list()) {
        const nombre =
          entrada.name ||
          entrada.uri.replace(/\/+$/, '').split('/').pop() ||
          '';
        if (!nombre || nombre.startsWith('.tmp_')) continue;
        const rutaHija = rutaActual ? `${rutaActual}/${nombre}` : nombre;
        if (esDirectorio(entrada)) {
          recorrer(entrada, rutaHija);
        } else {
          resultados.push(rutaHija);
        }
      }
    };

    recorrer(raiz, prefijo);
    return resultados;
  }
}

/**
 * Adaptador en memoria para Vitest, simuladores y pruebas unitarias aisladas.
 */
export class MemoryFilesystemAdapter implements FilesystemPort {
  private archivos = new Map<string, Uint8Array>();

  async escribir(rutaRelativa: string, datos: string | Uint8Array): Promise<string> {
    const rutaNorm = normalizarYValidarRuta(rutaRelativa);
    if (!rutaNorm) {
      throw new Error('Debe indicar una ruta relativa de archivo válida.');
    }
    const bytes = datosABytes(datos);
    this.archivos.set(rutaNorm, new Uint8Array(bytes));
    return rutaNorm;
  }

  async leer(rutaRelativa: string): Promise<string> {
    const bytes = await this.leerBytes(rutaRelativa);
    return utf8BytesATexto(bytes);
  }

  async leerBytes(rutaRelativa: string): Promise<Uint8Array> {
    const rutaNorm = normalizarYValidarRuta(rutaRelativa);
    const data = this.archivos.get(rutaNorm);
    if (!data) {
      throw new Error(`Archivo no encontrado: ${rutaRelativa}`);
    }
    return new Uint8Array(data);
  }

  async existe(rutaRelativa: string): Promise<boolean> {
    const rutaNorm = normalizarYValidarRuta(rutaRelativa);
    return this.archivos.has(rutaNorm);
  }

  async eliminar(rutaRelativa: string): Promise<void> {
    const rutaNorm = normalizarYValidarRuta(rutaRelativa);
    this.archivos.delete(rutaNorm);
  }

  async obtenerTamanoBytes(rutaRelativa: string): Promise<number> {
    const rutaNorm = normalizarYValidarRuta(rutaRelativa);
    const data = this.archivos.get(rutaNorm);
    return data ? data.byteLength : 0;
  }

  async listar(directorioRelativo = ''): Promise<string[]> {
    const prefijo = normalizarYValidarRuta(directorioRelativo);
    const lista: string[] = [];
    for (const clave of this.archivos.keys()) {
      if (!prefijo || clave === prefijo || clave.startsWith(`${prefijo}/`)) {
        lista.push(clave);
      }
    }
    return lista;
  }

  limpiar(): void {
    this.archivos.clear();
  }
}

let instanciaPorDefecto: FilesystemPort | null = null;

export function obtenerFilesystem(): FilesystemPort {
  if (!instanciaPorDefecto) {
    instanciaPorDefecto = esEntornoNativo()
      ? new ExpoFilesystemAdapter()
      : new MemoryFilesystemAdapter();
  }
  return instanciaPorDefecto;
}

export function configurarFilesystem(fs: FilesystemPort): void {
  instanciaPorDefecto = fs;
}

export function reiniciarFilesystemPorDefecto(): void {
  instanciaPorDefecto = null;
}
