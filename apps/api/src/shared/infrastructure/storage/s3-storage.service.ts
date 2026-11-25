import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private bucketListo: Promise<void> | null = null;
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
   * Crea el bucket si no existe (el servidor y el worker pueden arrancar contra un MinIO nuevo).
   * Se comprueba una sola vez por proceso; si falla, el siguiente uso lo vuelve a intentar.
   */
  asegurarBucket(): Promise<void> {
    this.bucketListo ??= this.crearBucketSiFalta().catch((error) => {
      this.bucketListo = null;
      throw error;
    });
    return this.bucketListo;
  }

  private async crearBucketSiFalta(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 404) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket ${this.bucket} creado`);
    }
  }

  /** El arranque no depende de MinIO: si no responde, se avisa y se reintenta en el primer uso. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.asegurarBucket();
    } catch (error) {
      this.logger.warn(`No se pudo verificar el bucket ${this.bucket} al arrancar: ${(error as Error).message}`);
    }
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
    await this.asegurarBucket();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  /** Descarga un objeto completo en memoria (PDF). Devuelve `null` si la clave no existe. */
  async obtenerBuffer(key: string): Promise<Buffer | null> {
    try {
      const respuesta = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return Buffer.from(await respuesta.Body!.transformToByteArray());
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  }
}
