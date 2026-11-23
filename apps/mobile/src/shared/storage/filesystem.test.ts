import { describe, it, expect, vi } from 'vitest';
import {
  ExpoFilesystemAdapter,
  ExpoFileLike,
  ExpoDirectoryLike,
  ExpoFileSystemModuleLike,
  MemoryFilesystemAdapter,
} from './filesystem';
import { bytesABase64 } from '../utils/base64';

/**
 * Simulador en memoria del API orientada a objetos de `expo-file-system` v57 (File/Directory/Paths).
 */
function crearModuloExpoFsFake(opciones?: { fallarAlMover?: boolean }): {
  mod: ExpoFileSystemModuleLike;
  archivos: Map<string, Uint8Array>;
  rutasCreadas: string[];
  movimientos: Array<{ desde: string; hacia: string }>;
} {
  const archivos = new Map<string, Uint8Array>();
  const directorios = new Set<string>(['file:///document', 'file:///cache']);
  const rutasCreadas: string[] = [];
  const movimientos: Array<{ desde: string; hacia: string }> = [];

  const unir = (...partes: Array<string | { uri: string }>): string => {
    const segs: string[] = [];
    for (const p of partes) {
      const raw = typeof p === 'string' ? p : p.uri;
      if (segs.length === 0) {
        segs.push(raw.replace(/\/+$/, ''));
      } else {
        segs.push(raw.replace(/^\/+|\/+$/g, ''));
      }
    }
    return segs.filter(Boolean).join('/');
  };

  class FakeDirectory implements ExpoDirectoryLike {
    readonly uri: string;
    constructor(...uris: Array<string | ExpoFileLike | ExpoDirectoryLike>) {
      this.uri = unir(...uris);
    }
    get name(): string {
      return this.uri.split('/').pop() ?? '';
    }
    get exists(): boolean {
      return directorios.has(this.uri);
    }
    create(options?: { intermediates?: boolean }): void {
      if (options?.intermediates) {
        const match = this.uri.match(/^([a-z]+:\/\/\/[^/]+)(.*)$/);
        if (match) {
          let actual = match[1];
          directorios.add(actual);
          for (const seg of match[2].split('/').filter(Boolean)) {
            actual = `${actual}/${seg}`;
            directorios.add(actual);
          }
          return;
        }
      }
      directorios.add(this.uri);
    }
    list(): Array<ExpoDirectoryLike | ExpoFileLike> {
      const prefijo = `${this.uri}/`;
      const hijos = new Map<string, ExpoDirectoryLike | ExpoFileLike>();
      for (const clave of archivos.keys()) {
        if (!clave.startsWith(prefijo)) continue;
        const resto = clave.slice(prefijo.length);
        const [primerSeg, ...mas] = resto.split('/');
        const uriHijo = `${this.uri}/${primerSeg}`;
        if (mas.length > 0) {
          if (!hijos.has(uriHijo)) {
            directorios.add(uriHijo);
            hijos.set(uriHijo, new FakeDirectory(uriHijo));
          }
        } else {
          hijos.set(uriHijo, new FakeFile(uriHijo));
        }
      }
      return Array.from(hijos.values());
    }
  }

  class FakeFile implements ExpoFileLike {
    readonly uri: string;
    constructor(...uris: Array<string | ExpoFileLike | ExpoDirectoryLike>) {
      this.uri = unir(...uris);
    }
    get name(): string {
      return this.uri.split('/').pop() ?? '';
    }
    get exists(): boolean {
      return archivos.has(this.uri);
    }
    get size(): number {
      return archivos.get(this.uri)?.byteLength ?? 0;
    }
    create(): void {
      rutasCreadas.push(this.uri);
      archivos.set(this.uri, new Uint8Array(0));
    }
    write(content: string | Uint8Array): void {
      const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
      archivos.set(this.uri, bytes);
    }
    async bytes(): Promise<Uint8Array> {
      const data = archivos.get(this.uri);
      if (!data) throw new Error(`ENOENT: ${this.uri}`);
      return new Uint8Array(data);
    }
    async text(): Promise<string> {
      return new TextDecoder().decode(await this.bytes());
    }
    delete(): void {
      archivos.delete(this.uri);
    }
    async move(destination: ExpoFileLike): Promise<void> {
      if (opciones?.fallarAlMover) {
        throw new Error('EIO: fallo al renombrar archivo temporal');
      }
      const data = archivos.get(this.uri);
      if (!data) throw new Error(`ENOENT: ${this.uri}`);
      archivos.set(destination.uri, data);
      archivos.delete(this.uri);
      movimientos.push({ desde: this.uri, hacia: destination.uri });
    }
  }

  const mod: ExpoFileSystemModuleLike = {
    File: FakeFile,
    Directory: FakeDirectory,
    Paths: {
      document: new FakeDirectory('file:///document'),
      cache: new FakeDirectory('file:///cache'),
    },
  };

  return { mod, archivos, rutasCreadas, movimientos };
}

describe('Filesystem Adapters (ExpoFilesystemAdapter y MemoryFilesystemAdapter)', () => {
  it('ExpoFilesystemAdapter persiste en Paths.document con escritura atómica (tmp -> move) (F2)', async () => {
    const { mod, archivos, movimientos } = crearModuloExpoFsFake();
    const adapter = new ExpoFilesystemAdapter(mod);

    const ruta = await adapter.escribir(
      'inspections/INS_1/photos/PH_1.jpg',
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    );

    expect(ruta).toBe('inspections/INS_1/photos/PH_1.jpg');
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].desde).toContain('/.tmp_');
    expect(movimientos[0].hacia).toBe('file:///document/inspections/INS_1/photos/PH_1.jpg');

    expect(await adapter.existe(ruta)).toBe(true);
    expect(await adapter.obtenerTamanoBytes(ruta)).toBe(4);
    expect(Array.from(await adapter.leerBytes(ruta))).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    expect(await adapter.listar('inspections/INS_1')).toEqual([ruta]);
    expect(archivos.size).toBe(1);

    await adapter.eliminar(ruta);
    expect(await adapter.existe(ruta)).toBe(false);
    expect(await adapter.obtenerTamanoBytes(ruta)).toBe(0);
  });

  it('ExpoFilesystemAdapter limpia el archivo temporal si falla el move atómico', async () => {
    const { mod, archivos } = crearModuloExpoFsFake({ fallarAlMover: true });
    const adapter = new ExpoFilesystemAdapter(mod);

    await expect(
      adapter.escribir('inspections/INS_1/signatures/SIG_1.svg', '<svg/>'),
    ).rejects.toThrow('EIO');

    expect(archivos.size).toBe(0);
  });

  it('rechaza path traversal (..) en rutas relativas', async () => {
    const { mod } = crearModuloExpoFsFake();
    const adapter = new ExpoFilesystemAdapter(mod);

    await expect(adapter.escribir('../fuera/archivo.txt', 'x')).rejects.toThrow(/traversal/i);
  });

  it('MemoryFilesystemAdapter decodifica Data URI Base64 sin usar global Buffer (F3)', async () => {
    const fs = new MemoryFilesystemAdapter();
    const original = new Uint8Array([10, 20, 30, 40]);
    const dataUri = `data:image/png;base64,${bytesABase64(original)}`;

    const bufferFromSpy = vi.spyOn(Buffer, 'from');
    try {
      await fs.escribir('inspections/INS_2/signatures/SIG_2.png', dataUri);
      const llamadasBase64OBinario = (bufferFromSpy.mock.calls as readonly unknown[][]).filter(
        (call) =>
          typeof call[0] === 'string' || call[0] instanceof Uint8Array || call[1] === 'base64',
      );
      expect(llamadasBase64OBinario).toHaveLength(0);
      expect(await fs.leerBytes('inspections/INS_2/signatures/SIG_2.png')).toEqual(original);
    } finally {
      bufferFromSpy.mockRestore();
    }
  });
});
