import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperacionSyncSchema, PayloadArchivoSyncSchema } from '@gafer/contracts';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
  SqliteDatabasePort,
} from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { MemoryFilesystemAdapter } from '../../../shared/storage/filesystem';
import { ArchivosLocalRepository } from './archivos-local.repository';
import { CompresorImagenPort, MAX_TAMANO_FOTO_BYTES } from './fotos-compresion';
import { generarSvgFirmaBase64 } from './firma-svg';

const INSPECCION_UUID = '11111111-2222-4333-8444-555555555555';
const TECNICO_UUID = '33333333-3333-4000-8000-000000000001';

function crearCompresorFake(tamanoSalida = 450 * 1024): CompresorImagenPort {
  return {
    async recomprimir() {
      const salida = new Uint8Array(tamanoSalida);
      salida[0] = 0xff;
      salida[1] = 0xd8;
      salida[salida.length - 2] = 0xff;
      salida[salida.length - 1] = 0xd9;
      return { bytes: salida, mimeType: 'image/jpeg' };
    },
  };
}

describe('ArchivosLocalRepository (files_local, Filesystem y sync_outbox)', () => {
  let db: SqliteDatabasePort;
  let repo: ArchivosLocalRepository;
  let fs: MemoryFilesystemAdapter;

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    db = await inicializarBaseDeDatos();
    fs = new MemoryFilesystemAdapter();
    repo = new ArchivosLocalRepository(db, fs);
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  it('guarda una foto comprimida (<= 1 MB) en filesystem, registra metadata en files_local y encola REGISTRO_ARCHIVO en sync_outbox (F1, F7)', async () => {
    const bufferPesado = new Uint8Array(2.5 * 1024 * 1024).fill(77);

    const resultado = await repo.guardarFoto({
      inspectionId: INSPECCION_UUID,
      buffer: bufferPesado,
      mimeType: 'image/jpeg',
      actorId: TECNICO_UUID,
      compresor: crearCompresorFake(512 * 1024),
    });

    expect(resultado.file_id).toBeDefined();
    expect(resultado.inspection_id).toBe(INSPECCION_UUID);
    expect(resultado.file_type).toBe('PHOTO');
    expect(resultado.size_bytes).toBe(512 * 1024);
    expect(resultado.size_bytes).toBeLessThanOrEqual(MAX_TAMANO_FOTO_BYTES);
    expect(resultado.local_path_relative).toContain(`inspections/INS_${INSPECCION_UUID}/photos/`);
    expect(resultado.upload_status).toBe('PENDING');

    expect(await fs.existe(resultado.local_path_relative)).toBe(true);
    expect(await fs.obtenerTamanoBytes(resultado.local_path_relative)).toBe(resultado.size_bytes);

    const recuperado = await repo.obtenerPorId(resultado.file_id);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.sha256).toBe(resultado.sha256);

    // Verificar operación REGISTRO_ARCHIVO en sync_outbox (§13.1.1, F7)
    const outbox = new OutboxQueue(db);
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes).toHaveLength(1);
    expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
    expect(pendientes[0].operacion.tipo).toBe('REGISTRO_ARCHIVO');
    expect(PayloadArchivoSyncSchema.safeParse(pendientes[0].operacion.payload).success).toBe(true);
    expect(pendientes[0].operacion.payload.fileId).toBe(resultado.file_id);
  });

  it('guarda firma SVG con extensión .svg y mime_type image/svg+xml sin usar Buffer (F3, F5)', async () => {
    const firmaSvg = generarSvgFirmaBase64([
      [
        { x: 10, y: 20 },
        { x: 120, y: 60 },
      ],
    ]);

    const bufferFromSpy = vi.spyOn(Buffer, 'from');
    try {
      const resultado = await repo.guardarFirma({
        inspectionId: INSPECCION_UUID,
        firmaBase64: firmaSvg,
        firmanteNombre: 'Carlos Mendez',
        firmanteCargo: 'Supervisor de Planta',
        actorId: TECNICO_UUID,
      });

      const llamadasBase64OBinario = (bufferFromSpy.mock.calls as readonly unknown[][]).filter(
        (call) =>
          typeof call[0] === 'string' || call[0] instanceof Uint8Array || call[1] === 'base64',
      );
      expect(llamadasBase64OBinario).toHaveLength(0);
      expect(resultado.file_type).toBe('SIGNATURE');
      expect(resultado.pinned).toBe(1);
      expect(resultado.mime_type).toBe('image/svg+xml');
      expect(resultado.local_path_relative).toMatch(
        new RegExp(`^inspections/INS_${INSPECCION_UUID}/signatures/SIG_.*\\.svg$`),
      );

      expect(await fs.existe(resultado.local_path_relative)).toBe(true);
      const contenidoGuardado = await fs.leer(resultado.local_path_relative);
      expect(contenidoGuardado).toContain('<svg');
      expect(contenidoGuardado).toContain('<path');
    } finally {
      bufferFromSpy.mockRestore();
    }
  });

  it('conserva extensión .png y mime_type image/png cuando se entrega una firma PNG (F5)', async () => {
    const firmaPngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const resultado = await repo.guardarFirma({
      inspectionId: INSPECCION_UUID,
      firmaBase64: firmaPngBase64,
      actorId: TECNICO_UUID,
    });

    expect(resultado.mime_type).toBe('image/png');
    expect(resultado.local_path_relative).toMatch(/\.png$/);
    expect(await fs.existe(resultado.local_path_relative)).toBe(true);
  });

  it('limpia el archivo del filesystem si falla el INSERT en SQLite (atomicidad guardarFoto/guardarFirma, F7)', async () => {
    const dbConFallo: SqliteDatabasePort = {
      execAsync: db.execAsync.bind(db),
      runAsync: db.runAsync.bind(db),
      getAllAsync: db.getAllAsync.bind(db),
      getFirstAsync: db.getFirstAsync.bind(db),
      closeAsync: db.closeAsync.bind(db),
      withExclusiveTransactionAsync: async () => {
        throw new Error('SQLITE_FULL: disco lleno');
      },
    };

    const repoConFallo = new ArchivosLocalRepository(dbConFallo, fs);

    await expect(
      repoConFallo.guardarFoto({
        inspectionId: INSPECCION_UUID,
        buffer: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        actorId: TECNICO_UUID,
      }),
    ).rejects.toThrow('SQLITE_FULL');

    // No debe quedar ningún archivo huérfano en disco ni registro en SQLite
    expect(await fs.listar()).toEqual([]);
    expect(await repo.listarPorInspeccion(INSPECCION_UUID)).toHaveLength(0);
  });

  it('revierte la eliminación en SQLite y outbox si falla fs.eliminar (atomicidad eliminar, F7)', async () => {
    const foto = await repo.guardarFoto({
      inspectionId: INSPECCION_UUID,
      buffer: new Uint8Array([10, 20, 30]),
      actorId: TECNICO_UUID,
    });

    const spyEliminar = vi
      .spyOn(fs, 'eliminar')
      .mockRejectedValueOnce(new Error('EACCES: archivo bloqueado'));

    await expect(repo.eliminar(foto.file_id)).rejects.toThrow('EACCES');
    spyEliminar.mockRestore();

    // La fila en files_local, el outbox y el archivo en disco siguen intactos (cero inconsistencia)
    expect(await repo.obtenerPorId(foto.file_id)).not.toBeNull();
    expect(await fs.existe(foto.local_path_relative)).toBe(true);

    const outbox = new OutboxQueue(db);
    await outbox.inicializar();
    expect(outbox.obtenerPendientes()).toHaveLength(1);
  });

  it('lista fotos y firmas por inspección y elimina coordinadamente archivo, fila SQLite y tarea outbox pendiente', async () => {
    const foto1 = await repo.guardarFoto({
      inspectionId: INSPECCION_UUID,
      buffer: new Uint8Array([1, 2, 3]),
      actorId: TECNICO_UUID,
    });
    await repo.guardarFoto({
      inspectionId: INSPECCION_UUID,
      buffer: new Uint8Array([4, 5, 6]),
      actorId: TECNICO_UUID,
    });
    await repo.guardarFirma({
      inspectionId: INSPECCION_UUID,
      firmaBase64: generarSvgFirmaBase64([[{ x: 0, y: 0 }, { x: 10, y: 10 }]]),
      actorId: TECNICO_UUID,
    });

    expect(await repo.listarPorInspeccion(INSPECCION_UUID)).toHaveLength(3);
    expect(await repo.listarPorInspeccion(INSPECCION_UUID, 'PHOTO')).toHaveLength(2);
    expect(await repo.listarPorInspeccion(INSPECCION_UUID, 'SIGNATURE')).toHaveLength(1);

    await repo.eliminar(foto1.file_id);

    expect(await fs.existe(foto1.local_path_relative)).toBe(false);
    expect(await repo.obtenerPorId(foto1.file_id)).toBeNull();

    const outbox = new OutboxQueue(db);
    await outbox.inicializar();
    expect(outbox.obtenerPendientes()).toHaveLength(2);
  });

  it('marca un archivo como subido con su remote_file_id', async () => {
    const foto = await repo.guardarFoto({
      inspectionId: INSPECCION_UUID,
      buffer: new Uint8Array([100, 101]),
      actorId: TECNICO_UUID,
    });

    await repo.marcarSubido(foto.file_id, 'remote-s3-key-12345');

    const actualizado = await repo.obtenerPorId(foto.file_id);
    expect(actualizado?.upload_status).toBe('UPLOADED');
    expect(actualizado?.remote_file_id).toBe('remote-s3-key-12345');
    expect(actualizado?.uploaded_at).toBeDefined();
  });
});
