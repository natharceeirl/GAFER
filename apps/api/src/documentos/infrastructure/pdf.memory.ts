import { Injectable } from '@nestjs/common';
import { AlmacenPdfPort, ColaPdfPort } from '../domain/ports/pdf.ports';

/** Solo para pruebas: la aplicación usa la cola de Redis (`ColaPdfBullmq`). */
@Injectable()
export class ColaPdfMemory implements ColaPdfPort {
  readonly trabajos: string[] = [];
  fallar: Error | null = null;

  async encolar(documentoId: string): Promise<void> {
    if (this.fallar) throw this.fallar;
    this.trabajos.push(documentoId);
  }
}

/** Solo para pruebas: la aplicación usa MinIO (`AlmacenPdfS3`). */
@Injectable()
export class AlmacenPdfMemory implements AlmacenPdfPort {
  private readonly objetos = new Map<string, Buffer>();
  fallar: Error | null = null;

  async guardar(clave: string, contenido: Buffer): Promise<void> {
    if (this.fallar) throw this.fallar;
    this.objetos.set(clave, contenido);
  }

  async obtener(clave: string): Promise<Buffer | null> {
    return this.objetos.get(clave) ?? null;
  }

  vaciar(): void {
    this.objetos.clear();
  }
}
