/**
 * GAFER Mobile — Adaptador de Sistema de Archivos (Filesystem)
 * Almacenamiento local persistente para binarios (fotos, firmas, planos)
 * según Guía Rev 2 (§5.2, §5.3).
 */

export interface FilesystemPort {
  escribir(rutaRelativa: string, datos: string | Uint8Array): Promise<string>;
  leer(rutaRelativa: string): Promise<string>;
  leerBytes(rutaRelativa: string): Promise<Uint8Array>;
  existe(rutaRelativa: string): Promise<boolean>;
  eliminar(rutaRelativa: string): Promise<void>;
  obtenerTamanoBytes(rutaRelativa: string): Promise<number>;
  listar(directorioRelativo?: string): Promise<string[]>;
}

/**
 * Adaptador en memoria para vitest, simuladores y pruebas unitarias aisladas.
 */
export class MemoryFilesystemAdapter implements FilesystemPort {
  private archivos = new Map<string, Uint8Array>();

  private normalizarRuta(ruta: string): string {
    return ruta.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  }

  async escribir(rutaRelativa: string, datos: string | Uint8Array): Promise<string> {
    const rutaNorm = this.normalizarRuta(rutaRelativa);
    let bytes: Uint8Array;
    if (typeof datos === 'string') {
      if (datos.startsWith('data:') && datos.includes(';base64,')) {
        const base64Parte = datos.split(';base64,')[1];
        bytes = Uint8Array.from(Buffer.from(base64Parte, 'base64'));
      } else {
        bytes = new TextEncoder().encode(datos);
      }
    } else {
      bytes = datos;
    }
    this.archivos.set(rutaNorm, bytes);
    return rutaNorm;
  }

  async leer(rutaRelativa: string): Promise<string> {
    const bytes = await this.leerBytes(rutaRelativa);
    return new TextDecoder().decode(bytes);
  }

  async leerBytes(rutaRelativa: string): Promise<Uint8Array> {
    const rutaNorm = this.normalizarRuta(rutaRelativa);
    const data = this.archivos.get(rutaNorm);
    if (!data) {
      throw new Error(`Archivo no encontrado: ${rutaRelativa}`);
    }
    return data;
  }

  async existe(rutaRelativa: string): Promise<boolean> {
    const rutaNorm = this.normalizarRuta(rutaRelativa);
    return this.archivos.has(rutaNorm);
  }

  async eliminar(rutaRelativa: string): Promise<void> {
    const rutaNorm = this.normalizarRuta(rutaRelativa);
    this.archivos.delete(rutaNorm);
  }

  async obtenerTamanoBytes(rutaRelativa: string): Promise<number> {
    const rutaNorm = this.normalizarRuta(rutaRelativa);
    const data = this.archivos.get(rutaNorm);
    return data ? data.byteLength : 0;
  }

  async listar(directorioRelativo = ''): Promise<string[]> {
    const prefijo = this.normalizarRuta(directorioRelativo);
    const lista: string[] = [];
    for (const clave of this.archivos.keys()) {
      if (!prefijo || clave.startsWith(prefijo)) {
        lista.push(clave);
      }
    }
    return lista;
  }

  limpiar(): void {
    this.archivos.clear();
  }
}

let instanciaPorDefecto: FilesystemPort = new MemoryFilesystemAdapter();

export function obtenerFilesystem(): FilesystemPort {
  return instanciaPorDefecto;
}

export function configurarFilesystem(fs: FilesystemPort): void {
  instanciaPorDefecto = fs;
}
