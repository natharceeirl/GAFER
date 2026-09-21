import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const accessKeyId = process.env.MINIO_ROOT_USER || 'gafer';
    const secretAccessKey = process.env.MINIO_ROOT_PASSWORD || 'gafersecret';
    this.bucket = process.env.MINIO_BUCKET || 'gafer-docs';

    this.client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Requerido para MinIO S3
    });
  }

  getBucketName(): string {
    return this.bucket;
  }

  /**
   * Genera una URL prefirmada para subida directa de archivos (fichas técnicas, MSDS)
   */
  async generarPresignedUploadUrl(
    key: string,
    contentType = 'application/pdf',
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Genera una URL prefirmada para visualización o descarga segura de archivos
   */
  async generarPresignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Sube un buffer directamente (ej. para reportes generados por el backend)
   */
  async subirBuffer(
    key: string,
    buffer: Buffer,
    contentType = 'application/pdf',
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);
  }
}
