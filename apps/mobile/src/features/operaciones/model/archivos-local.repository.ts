/**
 * GAFER Mobile — Repositorio de Archivos Locales (files_local)
 * Cumple con la Guía de Arquitectura Offline-First Rev 2 (§5.2, §5.3, §6.3, §13).
 *
 * Coordina de forma atómica:
 * 1. Compresión real C15 (<= 1 MB) y cálculo SHA-256 criptográfico.
 * 2. Escritura durable en filesystem relativo.
 * 3. Inserción de metadata en `files_local` + encolado de `REGISTRO_ARCHIVO` en `sync_outbox`
 *    dentro de una sola transacción SQLite (§13.1.1), con limpieza compensatoria en filesystem
 *    si SQLite falla.
 */

import { OperacionSync } from '@gafer/contracts';
import { SqliteDatabasePort, obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { FilesystemPort, obtenerFilesystem } from '../../../shared/storage/filesystem';
import { base64ABytes, extraerDataUriBase64, utf8BytesATexto } from '../../../shared/utils/base64';
import { generarUuid } from '../../../shared/utils/uuid';
import {
  comprimirFoto,
  calcularSha256,
  generarRutaFoto,
  generarRutaFirma,
  CompresorImagenPort,
  MAX_TAMANO_FOTO_BYTES,
} from './fotos-compresion';

export type FileTypeLocal = 'PHOTO' | 'SIGNATURE' | 'PLAN';
export type UploadStatusLocal = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
export type RetentionStateLocal = 'PENDING' | 'GRACE' | 'PURGED';
export type PdfSelectionStatusLocal = 'UNKNOWN' | 'SELECTED' | 'NOT_SELECTED';

const ACTOR_SISTEMA_FALLBACK_UUID = '00000000-0000-4000-8000-000000000000';

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
  uri?: string;
  buffer?: Uint8Array;
  base64?: string;
  mimeType?: string;
  descripcion?: string;
  pdfSelectionStatus?: PdfSelectionStatusLocal;
  actorId?: string;
  deviceId?: string;
  calidadInicial?: number;
  compresor?: CompresorImagenPort;
}

export interface GuardarFirmaParams {
  inspectionId: string;
  firmaBase64: string;
  mimeType?: string;
  firmanteNombre?: string;
  firmanteCargo?: string;
  actorId?: string;
  deviceId?: string;
}

function detectarMimeFirma(
  firmaBase64: string,
  bytes: Uint8Array,
  mimeExplicito?: string,
): string {
  const { mimeType: mimeDataUri } = extraerDataUriBase64(firmaBase64);
  const candidato = (mimeDataUri || mimeExplicito || '').trim().toLowerCase();

  if (candidato === 'image/svg+xml' || candidato === 'image/png' || candidato === 'image/jpeg') {
    return candidato;
  }

  // Inspección por firma de bytes (PNG magic bytes: 89 50 4E 47)
  if (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }

  // Inspección por contenido SVG
  const cabeceraTexto = utf8BytesATexto(bytes.slice(0, Math.min(bytes.byteLength, 256))).trimStart();
  if (cabeceraTexto.startsWith('<svg') || cabeceraTexto.startsWith('<?xml')) {
    return 'image/svg+xml';
  }

  return 'image/svg+xml';
}

export class ArchivosLocalRepository {
  private db?: SqliteDatabasePort;
  private fs?: FilesystemPort;

  constructor(db?: SqliteDatabasePort, fs?: FilesystemPort) {
    this.db = db;
    this.fs = fs;
  }

  private getDb(): SqliteDatabasePort {
    if (this.db) return this.db;
    return obtenerBaseDeDatos();
  }

  private getFs(): FilesystemPort {
    if (this.fs) return this.fs;
    return obtenerFilesystem();
  }

  private async persistirFilaYEncolar(
    fila: FilaFileLocal,
    actorId: string,
    deviceId?: string,
  ): Promise<void> {
    const db = this.getDb();
    const fs = this.getFs();

    const operacion: OperacionSync = {
      operationId: generarUuid(),
      tipo: 'REGISTRO_ARCHIVO',
      agregadoId: fila.inspection_id,
      actorId,
      clienteTimestamp: fila.captured_at,
      payload: {
        fileId: fila.file_id,
        fileType: fila.file_type,
        localPathRelative: fila.local_path_relative,
        sha256: fila.sha256,
        sizeBytes: fila.size_bytes,
        mimeType: fila.mime_type,
        pinned: fila.pinned === 1,
        capturedAt: fila.captured_at,
      },
    };

    try {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(
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

        const outbox = new OutboxQueue(tx);
        await outbox.encolar(operacion, {
          deviceId,
          aggregateType: 'ARCHIVO_LOCAL',
          priority: fila.file_type === 'SIGNATURE' ? 'HIGH' : 'NORMAL',
        });
      });
    } catch (error) {
      // Compensación anti-huérfanos (§13.1.1): si falla SQLite/outbox, limpiar el binario en disco.
      try {
        await fs.eliminar(fila.local_path_relative);
      } catch {
        // Preservar el error original de persistencia.
      }
      throw error;
    }
  }

  /**
   * Procesa, comprime a <= 1 MB (Decisión C15), escribe en el filesystem y registra
   * la metadata de la foto en `files_local` + operación `REGISTRO_ARCHIVO` en `sync_outbox`
   * dentro de una sola transacción.
   */
  async guardarFoto(params: GuardarFotoParams): Promise<FilaFileLocal> {
    const fileId = generarUuid();
    const ahora = new Date().toISOString();

    // 1. Pipeline de compresión obligatoria C15
    const comprimida = await comprimirFoto(
      {
        uri: params.uri,
        buffer: params.buffer,
        base64: params.base64,
        mimeType: params.mimeType || 'image/jpeg',
        nombreOriginal: params.nombre,
      },
      {
        maxBytes: MAX_TAMANO_FOTO_BYTES,
        calidadInicial: params.calidadInicial,
        compresor: params.compresor,
      },
    );

    if (comprimida.tamanoBytes > MAX_TAMANO_FOTO_BYTES) {
      throw new Error(`La fotografía procesada excede 1 MB (${comprimida.tamanoBytes} bytes)`);
    }

    // 2. Ruta canónica según jerarquía §5.3
    const rutaRelativa = generarRutaFoto(params.inspectionId, fileId);

    // 3. Escribir binario de forma durable en el filesystem (atómico tmp -> move en nativo)
    await this.getFs().escribir(rutaRelativa, comprimida.buffer);

    // 4. Registro atómico en SQLite (`files_local` + `sync_outbox`)
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

    await this.persistirFilaYEncolar(
      fila,
      params.actorId || ACTOR_SISTEMA_FALLBACK_UUID,
      params.deviceId,
    );

    return fila;
  }

  /**
   * Guarda la firma manuscrita capturada en pantalla en el filesystem con extensión y MIME
   * coherentes con el formato real (SVG por defecto o PNG), registra su metadata en `files_local`
   * y encola la operación `REGISTRO_ARCHIVO` en `sync_outbox` de forma atómica.
   */
  async guardarFirma(params: GuardarFirmaParams): Promise<FilaFileLocal> {
    const fileId = generarUuid();
    const ahora = new Date().toISOString();

    const buffer = base64ABytes(params.firmaBase64);
    if (buffer.byteLength === 0) {
      throw new Error('La firma capturada está vacía y no puede guardarse.');
    }

    const mimeType = detectarMimeFirma(params.firmaBase64, buffer, params.mimeType);
    const rutaRelativa = generarRutaFirma(params.inspectionId, fileId, mimeType);
    const sha256 = await calcularSha256(buffer);

    await this.getFs().escribir(rutaRelativa, buffer);

    const fila: FilaFileLocal = {
      file_id: fileId,
      inspection_id: params.inspectionId,
      file_type: 'SIGNATURE',
      local_path_relative: rutaRelativa,
      pinned: 1, // Firmas fijadas por seguridad
      remote_file_id: null,
      sha256,
      size_bytes: buffer.byteLength,
      mime_type: mimeType,
      upload_status: 'PENDING',
      retention_state: 'PENDING',
      pdf_selection_status: 'SELECTED',
      captured_at: ahora,
      uploaded_at: null,
      local_purge_after: null,
      purged_at: null,
    };

    await this.persistirFilaYEncolar(
      fila,
      params.actorId || ACTOR_SISTEMA_FALLBACK_UUID,
      params.deviceId,
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
   * Elimina el archivo de forma coordinada y atómica entre SQLite (`files_local` + tarea
   * `PENDING` en `sync_outbox`) y el filesystem. Si falla el borrado en disco o en SQLite,
   * la transacción se revierte sin dejar registros huérfanos.
   */
  async eliminar(fileId: string): Promise<void> {
    const db = this.getDb();
    const fs = this.getFs();

    await db.withExclusiveTransactionAsync(async (tx) => {
      const fila = await tx.getFirstAsync<FilaFileLocal>(
        `SELECT * FROM files_local WHERE file_id = ?;`,
        [fileId],
      );
      if (!fila) return;

      await tx.runAsync(`DELETE FROM files_local WHERE file_id = ?;`, [fileId]);

      const opsPendientes = await tx.getAllAsync<{ operation_id: string; payload_json: string }>(
        `SELECT operation_id, payload_json FROM sync_outbox
         WHERE aggregate_id = ? AND operation_type = 'REGISTRO_ARCHIVO' AND status = 'PENDING';`,
        [fila.inspection_id],
      );

      for (const op of opsPendientes) {
        try {
          const parsed = JSON.parse(op.payload_json) as { fileId?: string };
          if (parsed?.fileId === fileId) {
            await tx.runAsync(`DELETE FROM sync_outbox WHERE operation_id = ?;`, [op.operation_id]);
          }
        } catch {
          // Ignorar filas con JSON no parseable.
        }
      }

      await fs.eliminar(fila.local_path_relative);
    });
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
