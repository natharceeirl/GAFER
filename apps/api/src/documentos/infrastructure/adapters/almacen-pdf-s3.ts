import { Injectable } from '@nestjs/common';
import { S3StorageService } from '../../../shared/infrastructure/storage/s3-storage.service';
import { AlmacenPdfPort } from '../../domain/ports/pdf.ports';

/** Guarda los PDF en el bucket `gafer-docs` (MinIO en desarrollo, R2 en producción). */
@Injectable()
export class AlmacenPdfS3 implements AlmacenPdfPort {
  constructor(private readonly s3: S3StorageService) {}

  guardar(clave: string, contenido: Buffer): Promise<void> {
    return this.s3.subirBuffer(clave, contenido, 'application/pdf');
  }

  obtener(clave: string): Promise<Buffer | null> {
    return this.s3.obtenerBuffer(clave);
  }
}
