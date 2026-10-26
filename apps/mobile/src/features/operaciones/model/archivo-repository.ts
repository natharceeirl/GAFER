/**
 * GAFER Mobile — ArchivoRepository
 * Repositorio para persistencia física y metadatos de archivos locales (Guía Rev 2 §5.3, §6.3).
 * Utiliza la API moderna Paths, Directory y File de expo-file-system en SDK 57.
 *
 * REGLAS CLAVE:
 * - En SQLite se guardan rutas RELATIVAS (local_path_relative) resueltas contra Paths.document.
 * - Ningún binario se guarda en Base64 en SQLite.
 * - Archivos persistentes en documentDirectory, nunca en cacheDirectory.
 */

import { SqliteDatabasePort, obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { Paths, Directory, File } from 'expo-file-system';

export interface ArchivoLocalEntity {
  fileId: string;
  inspectionId: string;
  fileType: 'FOTO_EVIDENCIA' | 'FIRMA_CLIENTE' | 'PLANO_BASE';
  localPathRelative: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
  capturedAt: string;
}

interface FilaArchivoLocalDb {
  file_id: string;
  inspection_id: string;
  file_type: string;
  local_path_relative: string;
  pinned: number;
  remote_file_id: string | null;
  sha256: string;
  size_bytes: number;
  mime_type: string;
  upload_status: string;
  captured_at: string;
}

export class ArchivoRepository {
  constructor(private readonly db?: SqliteDatabasePort) {}

  private getDb(): SqliteDatabasePort {
    return this.db ?? obtenerBaseDeDatos();
  }

  /**
   * Resuelve la ruta absoluta en el dispositivo a partir de la ruta relativa persistida en SQLite.
   */
  static resolverRutaAbsoluta(localPathRelative: string): string {
    const docUri = Paths.document.uri;
    const base = docUri.endsWith('/') ? docUri : `${docUri}/`;
    return `${base}${localPathRelative}`;
  }

  /**
   * Guarda una foto física en documentDirectory y registra sus metadatos en files_local.
   */
  async guardarFotoDesdeUriTemporal(
    inspectionId: string,
    uriTemporal: string,
    mimeType = 'image/jpeg',
  ): Promise<ArchivoLocalEntity> {
    const db = this.getDb();
    const fileId = `foto-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const ahora = new Date().toISOString();

    // 1. Crear directorio permanente dentro de Paths.document asegurando intermedios
    const carpetaRelativa = `inspecciones/${inspectionId}/fotos/`;
    const dir = new Directory(Paths.document, 'inspecciones', inspectionId, 'fotos');
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }

    // 2. Copiar archivo desde el URI temporal al destino permanente
    const nombreArchivo = `${fileId}.jpg`;
    const pathRelativo = `${carpetaRelativa}${nombreArchivo}`;

    const fuente = new File(uriTemporal);
    const destino = new File(dir, nombreArchivo);
    await fuente.copy(destino);

    const sizeBytes = destino.exists ? (destino.size ?? 0) : 0;
    const sha256Simulado = `sha256-${fileId}-${sizeBytes}`;

    // 3. Persistir metadatos en SQLite con transacción exclusiva
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO files_local (
          file_id,
          inspection_id,
          file_type,
          local_path_relative,
          pinned,
          remote_file_id,
          sha256,
          size_bytes,
          mime_type,
          upload_status,
          retention_state,
          pdf_selection_status,
          captured_at
        ) VALUES (?, ?, ?, ?, 1, NULL, ?, ?, ?, 'PENDING', 'ACTIVE', 'SELECTED', ?);`,
        [
          fileId,
          inspectionId,
          'FOTO_EVIDENCIA',
          pathRelativo,
          sha256Simulado,
          sizeBytes,
          mimeType,
          ahora,
        ],
      );
    });

    return {
      fileId,
      inspectionId,
      fileType: 'FOTO_EVIDENCIA',
      localPathRelative: pathRelativo,
      sizeBytes,
      mimeType,
      sha256: sha256Simulado,
      uploadStatus: 'PENDING',
      capturedAt: ahora,
    };
  }

  /**
   * Lista todos los archivos locales asociados a una inspección desde SQLite.
   */
  async listarArchivos(inspectionId: string): Promise<ArchivoLocalEntity[]> {
    const db = this.getDb();
    const filas = await db.getAllAsync<FilaArchivoLocalDb>(
      `SELECT * FROM files_local 
       WHERE inspection_id = ? 
       ORDER BY captured_at DESC;`,
      [inspectionId],
    );

    return filas.map((f) => ({
      fileId: f.file_id,
      inspectionId: f.inspection_id,
      fileType: f.file_type as any,
      localPathRelative: f.local_path_relative,
      sizeBytes: f.size_bytes,
      mimeType: f.mime_type,
      sha256: f.sha256,
      uploadStatus: f.upload_status as any,
      capturedAt: f.captured_at,
    }));
  }

  /**
   * Elimina un archivo físico del disco y su registro en SQLite.
   */
  async eliminarArchivo(fileId: string): Promise<void> {
    const db = this.getDb();
    const fila = await db.getFirstAsync<FilaArchivoLocalDb>(
      `SELECT * FROM files_local WHERE file_id = ?;`,
      [fileId],
    );

    if (fila) {
      const rutaAbsoluta = ArchivoRepository.resolverRutaAbsoluta(fila.local_path_relative);
      try {
        const file = new File(rutaAbsoluta);
        if (file.exists) {
          await file.delete();
        }
      } catch {
        // Ignorar si el archivo ya no existe físicamente
      }

      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(`DELETE FROM files_local WHERE file_id = ?;`, [fileId]);
      });
    }
  }

  /**
   * Genera un archivo de foto de prueba con carga útil realista para pruebas de estrés.
   */
  async generarFotoDePrueba(
    inspectionId: string,
    indice: number,
  ): Promise<ArchivoLocalEntity> {
    const db = this.getDb();
    const fileId = `estres-foto-${indice}-${Date.now()}`;
    const ahora = new Date().toISOString();

    const carpetaRelativa = `inspecciones/${inspectionId}/fotos/`;
    const dir = new Directory(Paths.document, 'inspecciones', inspectionId, 'fotos');
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }

    const nombreArchivo = `${fileId}.jpg`;
    const pathRelativo = `${carpetaRelativa}${nombreArchivo}`;
    const destino = new File(dir, nombreArchivo);

    // Carga útil realista de ~150 KB para simular compresión JPEG de cámara móvil
    const bloqueSimulado = 'GAFER_SPIKE_IMG_PAYLOAD_EVIDENCE_STRESS_TEST_BUFFER_BLOCK_';
    const contenido = bloqueSimulado.repeat(2600);
    await destino.write(contenido);

    const sizeBytes = destino.exists ? (destino.size ?? contenido.length) : contenido.length;
    const sha256Simulado = `sha256-stress-${fileId}-${sizeBytes}`;

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO files_local (
          file_id,
          inspection_id,
          file_type,
          local_path_relative,
          pinned,
          remote_file_id,
          sha256,
          size_bytes,
          mime_type,
          upload_status,
          retention_state,
          pdf_selection_status,
          captured_at
        ) VALUES (?, ?, 'FOTO_EVIDENCIA', ?, 1, NULL, ?, ?, 'image/jpeg', 'PENDING', 'ACTIVE', 'SELECTED', ?);`,
        [fileId, inspectionId, pathRelativo, sha256Simulado, sizeBytes, ahora],
      );
    });

    return {
      fileId,
      inspectionId,
      fileType: 'FOTO_EVIDENCIA',
      localPathRelative: pathRelativo,
      sizeBytes,
      mimeType: 'image/jpeg',
      sha256: sha256Simulado,
      uploadStatus: 'PENDING',
      capturedAt: ahora,
    };
  }

  /**
   * Genera 20 fotos físicas en documentDirectory y las registra en SQLite para prueba §22.6.
   */
  async generarLoteDe20FotosEstres(inspectionId: string): Promise<number> {
    for (let i = 1; i <= 20; i++) {
      await this.generarFotoDePrueba(inspectionId, i);
    }
    return 20;
  }

  /**
   * Elimina todos los archivos físicos y registros SQLite de una inspección de prueba.
   */
  async limpiarArchivosDeInspeccion(inspectionId: string): Promise<void> {
    const archivos = await this.listarArchivos(inspectionId);
    for (const a of archivos) {
      await this.eliminarArchivo(a.fileId);
    }
  }

  /**
   * Calcula el peso total en bytes y cantidad de fotos de una inspección.
   */
  async obtenerMetricasAlmacenamiento(
    inspectionId: string,
  ): Promise<{ totalArchivos: number; totalBytes: number }> {
    const db = this.getDb();
    const res = await db.getFirstAsync<{ total_archivos: number; total_bytes: number | null }>(
      `SELECT COUNT(*) as total_archivos, SUM(size_bytes) as total_bytes 
       FROM files_local 
       WHERE inspection_id = ?;`,
      [inspectionId],
    );

    return {
      totalArchivos: res?.total_archivos ?? 0,
      totalBytes: res?.total_bytes ?? 0,
    };
  }
}
