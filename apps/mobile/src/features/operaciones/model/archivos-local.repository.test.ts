import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
} from '../../../shared/db/sqlite';
import { MemoryFilesystemAdapter } from '../../../shared/storage/filesystem';
import { ArchivosLocalRepository } from './archivos-local.repository';
import { MAX_TAMANO_FOTO_BYTES } from './fotos-compresion';

describe('ArchivosLocalRepository (files_local en SQLite y Filesystem)', () => {
  let repo: ArchivosLocalRepository;
  let fs: MemoryFilesystemAdapter;

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    const db = await inicializarBaseDeDatos();
    fs = new MemoryFilesystemAdapter();
    repo = new ArchivosLocalRepository(db, fs);
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  it('guarda una foto comprimida (< 1 MB) en filesystem y registra su metadata en SQLite', async () => {
    const inspectionId = 'ins-0001-test';
    const bufferPesado = Buffer.alloc(2.5 * 1024 * 1024, 77); // 2.5 MB

    const resultado = await repo.guardarFoto({
      inspectionId,
      buffer: Uint8Array.from(bufferPesado),
      mimeType: 'image/jpeg',
    });

    expect(resultado.file_id).toBeDefined();
    expect(resultado.inspection_id).toBe(inspectionId);
    expect(resultado.file_type).toBe('PHOTO');
    expect(resultado.size_bytes).toBeLessThanOrEqual(MAX_TAMANO_FOTO_BYTES);
    expect(resultado.local_path_relative).toContain(`inspections/INS_${inspectionId}/photos/`);
    expect(resultado.upload_status).toBe('PENDING');

    // Verificar en filesystem
    const existeEnFs = await fs.existe(resultado.local_path_relative);
    expect(existeEnFs).toBe(true);

    const tamanoEnFs = await fs.obtenerTamanoBytes(resultado.local_path_relative);
    expect(tamanoEnFs).toBe(resultado.size_bytes);

    // Verificar en SQLite
    const recuperado = await repo.obtenerPorId(resultado.file_id);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.sha256).toBe(resultado.sha256);
  });

  it('guarda una firma manuscrita en filesystem y registra su metadata en SQLite', async () => {
    const inspectionId = 'ins-0002-test';
    const firmaMockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const resultado = await repo.guardarFirma({
      inspectionId,
      firmaBase64: firmaMockBase64,
      firmanteNombre: 'Carlos Mendez',
      firmanteCargo: 'Supervisor de Planta',
    });

    expect(resultado.file_type).toBe('SIGNATURE');
    expect(resultado.pinned).toBe(1);
    expect(resultado.mime_type).toBe('image/png');
    expect(resultado.local_path_relative).toContain(`inspections/INS_${inspectionId}/signatures/`);

    const existeEnFs = await fs.existe(resultado.local_path_relative);
    expect(existeEnFs).toBe(true);
  });

  it('lista fotos y firmas por inspección con filtros opcionales', async () => {
    const inspectionId = 'ins-0003-test';

    await repo.guardarFoto({
      inspectionId,
      buffer: Uint8Array.from([1, 2, 3]),
    });
    await repo.guardarFoto({
      inspectionId,
      buffer: Uint8Array.from([4, 5, 6]),
    });
    await repo.guardarFirma({
      inspectionId,
      firmaBase64: 'base64-mock',
    });

    const todos = await repo.listarPorInspeccion(inspectionId);
    expect(todos).toHaveLength(3);

    const soloFotos = await repo.listarPorInspeccion(inspectionId, 'PHOTO');
    expect(soloFotos).toHaveLength(2);

    const soloFirmas = await repo.listarPorInspeccion(inspectionId, 'SIGNATURE');
    expect(soloFirmas).toHaveLength(1);
  });

  it('elimina un archivo de forma coordinada en SQLite y en el Filesystem', async () => {
    const inspectionId = 'ins-0004-test';
    const foto = await repo.guardarFoto({
      inspectionId,
      buffer: Uint8Array.from([10, 20, 30]),
    });

    expect(await fs.existe(foto.local_path_relative)).toBe(true);
    expect(await repo.obtenerPorId(foto.file_id)).not.toBeNull();

    await repo.eliminar(foto.file_id);

    expect(await fs.existe(foto.local_path_relative)).toBe(false);
    expect(await repo.obtenerPorId(foto.file_id)).toBeNull();
  });

  it('marca un archivo como subido con su remote_file_id', async () => {
    const inspectionId = 'ins-0005-test';
    const foto = await repo.guardarFoto({
      inspectionId,
      buffer: Uint8Array.from([100, 101]),
    });

    await repo.marcarSubido(foto.file_id, 'remote-s3-key-12345');

    const actualizado = await repo.obtenerPorId(foto.file_id);
    expect(actualizado?.upload_status).toBe('UPLOADED');
    expect(actualizado?.remote_file_id).toBe('remote-s3-key-12345');
    expect(actualizado?.uploaded_at).toBeDefined();
  });
});
