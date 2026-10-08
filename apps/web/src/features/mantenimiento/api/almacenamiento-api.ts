import type { GenerarDownloadUrl, GenerarUploadUrl } from '@gafer/contracts';
import { ErrorApi, errorDeRed } from '../../../shared/api/errores';
import { apiFetch } from '../../../shared/api/http-client';
import { claveDePdf, type CarpetaPdf } from '../model/validaciones';

const RUTA = '/mantenimiento/storage';
const TIPO_PDF = 'application/pdf';

interface RespuestaSubida {
  key: string;
  uploadUrl: string;
  bucket: string;
  expiresInSeconds: number;
}

interface RespuestaDescarga {
  key: string;
  downloadUrl: string;
  expiresInSeconds: number;
}

const MENSAJE_SUBIDA = 'No se pudo subir el archivo. Intente de nuevo.';

/**
 * Sube un PDF al almacenamiento: pide al API una URL prefirmada, envía el archivo con un PUT directo a esa URL
 * y devuelve la clave que luego se guarda en el insumo. El PUT no lleva la sesión del API: la URL ya está firmada.
 */
export async function subirPdf(archivo: File, carpeta: CarpetaPdf): Promise<string> {
  const key = claveDePdf(carpeta);
  const solicitud: GenerarUploadUrl = { key, contentType: TIPO_PDF };
  const { uploadUrl } = await apiFetch<RespuestaSubida>(`${RUTA}/upload-url`, { metodo: 'POST', cuerpo: solicitud });

  let respuesta: Response;
  try {
    respuesta = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': TIPO_PDF }, body: archivo });
  } catch {
    throw errorDeRed();
  }
  if (!respuesta.ok) throw new ErrorApi({ tipo: 'servidor', status: respuesta.status, mensaje: MENSAJE_SUBIDA });
  return key;
}

/** URL prefirmada, de vida corta, para ver o descargar el archivo de una clave. */
export async function urlDeDescarga(key: string): Promise<string> {
  const solicitud: GenerarDownloadUrl = { key };
  const { downloadUrl } = await apiFetch<RespuestaDescarga>(`${RUTA}/download-url`, { metodo: 'POST', cuerpo: solicitud });
  return downloadUrl;
}
