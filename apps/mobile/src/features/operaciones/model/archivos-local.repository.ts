/**
 * GAFER Mobile — Repositorio de Archivos Locales (files_local)
 * Cumple con la Guía de Arquitectura Offline-First Rev 2 (§5.2, §5.3, §6.3, §13).
 * Coordina la escritura atómica de binarios en Filesystem y metadata en SQLite.
 */

import { SqliteDatabasePort, obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { FilesystemPort, obtenerFilesystem } from '../../../shared/storage/filesystem';
import { generarUuid } from '../../../shared/utils/uuid';
import {
  comprimirFoto,
  calcularSha256,
  generarRutaFoto,
  generarRutaFirma,
  MAX_TAMANO_FOTO_BYTES,
} from './fotos-compresion';

export type FileTypeLocal = 'PHOTO' | 'SIGNATURE' | 'PLAN';
export type UploadStatusLocal = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
export type RetentionStateLocal = 'PENDING' | 'GRACE' | 'PURGED';
export type PdfSelectionStatusLocal = 'UNKNOWN' | 'SELECTED' | 'NOT_SELECTED';

export interface FilaFileLocal {
  file_id: string;
  inspection_id: string;
  file_type: FileTypeLocal;
  local_path_relative: string;
  pinned: number;
  remote_file_id: string | null;
  sha256: string;
  size_bytes: number;
  mime_type: string;
  upload_status: UploadStatusLocal;
  retention_state: RetentionStateLocal;
  pdf_selection_status: PdfSelectionStatusLocal;
  captured_at: string;
  uploaded_at: string | null;
  local_purge_after: string | null;
  purged_at: string | null;
}

export interface GuardarFotoParams {
  inspectionId: string;
  nombre?: string;
  buffer?: Uint8Array;
  base64?: string;
  mimeType?: string;
  descripcion?: string;
  pdfSelectionStatus?: PdfSelectionStatusLocal;
}

export interface GuardarFirmaParams {
  inspectionId: string;
  firmaBase64: string;
  firmanteNombre?: string;
  firmanteCargo?: string;
}

export class ArchivosLocalRepository {
  private db?: SqliteDatabasePort;
  private fs: FilesystemPort;

  constructor(db?: SqliteDatabasePort, fs?: FilesystemPort) {
    this.db = db;
    this.fs = fs || obtenerFilesystem();
  }

  private getDb(): SqliteDatabasePort {
    if (this.db) return this.db;
    return obtenerBaseDeDatos();
  }

  /**
   * Procesa, comprime a <= 1 MB (Decisión C15), escribe en el filesystem y registra
   * la metadata de la foto en la tabla files_local de SQLite de forma atómica.
   */
  async guardarFoto(params: GuardarFotoParams): Promise<FilaFileLocal> {
    const fileId = generarUuid();
    const ahora = new Date().toISOString();

    // 1. Pipeline de compresión obligatoria C15
    const comprimida = await comprimirFoto({
      buffer: params.buffer,
      base64: params.base64,
      mimeType: params.mimeType || 'image/jpeg',
    });

    if (comprimida.tamanoBytes > MAX_TAMANO_FOTO_BYTES) {
      throw new Error(`La fotografía procesada excede 1 MB (${comprimida.tamanoBytes} bytes)`);
    }

    // 2. Ruta canónica según jerarquía §5.3
    const rutaRelativa = generarRutaFoto(params.inspectionId, fileId);

    // 3. Escribir binario de forma durable en el filesystem
    await this.fs.escribir(rutaRelativa, comprimida.buffer);

    // 4. Registro en SQLite
    const fila: FilaFileLocal = {
      file_id: fileId,
      inspection_id: params.inspectionId,
      file_type: 'PHOTO',
      local_path_relative: rutaRelativa,
      pinned: 0,
      remote_file_id: null,
      sha256: comprimida.sha256,
      size_bytes: comprimida.tamanoBytes,
      mime_type: comprimida.mimeType,
      upload_status: 'PENDING',
      retention_state: 'PENDING',
      pdf_selection_status: params.pdfSelectionStatus || 'UNKNOWN',
      captured_at: ahora,
      uploaded_at: null,
      local_purge_after: null,
      purged_at: null,
    };

    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO files_local (
        file_id, inspection_id, file_type, local_path_relative, pinned,
        remote_file_id, sha256, size_bytes, mime_type, upload_status,
        retention_state, pdf_selection_status, captured_at, uploaded_at,
        local_purge_after, purged_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        fila.file_id,
        fila.inspection_id,
        fila.file_type,
        fila.local_path_relative,
        fila.pinned,
        fila.remote_file_id,
        fila.sha256,
        fila.size_bytes,
        fila.mime_type,
        fila.upload_status,
        fila.retention_state,
        fila.pdf_selection_status,
        fila.captured_at,
        fila.uploaded_at,
        fila.local_purge_after,
        fila.purged_at,
      ],
    );

    return fila;
  }

  /**
   * Guarda la firma manuscrita capturada en pantalla en el filesystem y registra su metadata.
   */
  async guardarFirma(params: GuardarFirmaParams): Promise<FilaFileLocal> {
    const fileId = generarUuid();
    const ahora = new Date().toISOString();

    const parteBase64 = params.firmaBase64.includes(';base64,')
      ? params.firmaBase64.split(';base64,')[1]
      : params.firmaBase64;
    const buffer = Uint8Array.from(Buffer.from(parteBase64, 'base64'));

    const rutaRelativa = generarRutaFirma(params.inspectionId, fileId);
    await this.fs.escribir(rutaRelativa, buffer);

    const sha256 = await calcularSha256(buffer);

    const fila: FilaFileLocal = {
      file_id: fileId,
      inspection_id: params.inspectionId,
      file_type: 'SIGNATURE',
      local_path_relative: rutaRelativa,
      pinned: 1, // Firmas fijadas por seguridad
      remote_file_id: null,
      sha256,
      size_bytes: buffer.byteLength,
      mime_type: 'image/png',
      upload_status: 'PENDING',
      retention_state: 'PENDING',
      pdf_selection_status: 'SELECTED',
      captured_at: ahora,
      uploaded_at: null,
      local_purge_after: null,
      purged_at: null,
    };

    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO files_local (
        file_id, inspection_id, file_type, local_path_relative, pinned,
        remote_file_id, sha256, size_bytes, mime_type, upload_status,
        retention_state, pdf_selection_status, captured_at, uploaded_at,
        local_purge_after, purged_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        fila.file_id,
        fila.inspection_id,
        fila.file_type,
        fila.local_path_relative,
        fila.pinned,
        fila.remote_file_id,
        fila.sha256,
        fila.size_bytes,
        fila.mime_type,
        fila.upload_status,
        fila.retention_state,
        fila.pdf_selection_status,
        fila.captured_at,
        fila.uploaded_at,
        fila.local_purge_after,
        fila.purged_at,
      ],
    );

    return fila;
  }

  /**
   * Lista los archivos asociados a una inspección.
   */
  async listarPorInspeccion(
    inspectionId: string,
    fileType?: FileTypeLocal,
  ): Promise<FilaFileLocal[]> {
    const db = this.getDb();
    if (fileType) {
      return db.getAllAsync<FilaFileLocal>(
        `SELECT * FROM files_local WHERE inspection_id = ? AND file_type = ? ORDER BY captured_at ASC;`,
        [inspectionId, fileType],
      );
    }
    return db.getAllAsync<FilaFileLocal>(
      `SELECT * FROM files_local WHERE inspection_id = ? ORDER BY captured_at ASC;`,
      [inspectionId],
    );
  }

  /**
   * Obtiene la metadata de un archivo por su identificador único.
   */
  async obtenerPorId(fileId: string): Promise<FilaFileLocal | null> {
    const db = this.getDb();
    return db.getFirstAsync<FilaFileLocal>(
      `SELECT * FROM files_local WHERE file_id = ?;`,
      [fileId],
    );
  }

  /**
   * Elimina el archivo del filesystem y su registro de SQLite.
   */
  async eliminar(fileId: string): Promise<void> {
    const fila = await this.obtenerPorId(fileId);
    if (!fila) return;

    await this.fs.eliminar(fila.local_path_relative);
    const db = this.getDb();
    await db.runAsync(`DELETE FROM files_local WHERE file_id = ?;`, [fileId]);
  }

  /**
   * Actualiza el estado de upload a UPLOADED confirmando el remote_file_id.
   */
  async marcarSubido(fileId: string, remoteFileId: string): Promise<void> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    await db.runAsync(
      `UPDATE files_local 
       SET upload_status = 'UPLOADED', 
           remote_file_id = ?, 
           uploaded_at = ? 
       WHERE file_id = ?;`,
      [remoteFileId, ahora, fileId],
    );
  }
}
