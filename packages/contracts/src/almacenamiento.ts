import { z } from 'zod';

/** Solicitud de una URL prefirmada para subir un archivo (ficha técnica, hoja MSDS) al almacenamiento S3. */
export const GenerarUploadUrlSchema = z.object({
  key: z.string().min(1).describe('Clave de destino en MinIO S3'),
  contentType: z.string().optional().describe('Tipo de contenido del archivo (MIME)'),
});
export type GenerarUploadUrl = z.infer<typeof GenerarUploadUrlSchema>;

/** Solicitud de una URL prefirmada para descargar un archivo del almacenamiento S3. */
export const GenerarDownloadUrlSchema = z.object({
  key: z.string().min(1).describe('Clave del archivo en MinIO S3'),
});
export type GenerarDownloadUrl = z.infer<typeof GenerarDownloadUrlSchema>;
