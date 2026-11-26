import { createHash } from 'crypto';
import { ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import { ALMACEN_PDF, AlmacenPdfPort } from '../domain/ports/pdf.ports';

export interface PdfDescargable {
  contenido: Buffer;
  nombreArchivo: string;
}

/** El PDF almacenado no es el que se emitió: nunca se sirve, y quien llama debe dejar constancia. */
export class PdfIntegridadException extends InternalServerErrorException {
  constructor(
    public readonly documentoId: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

@Injectable()
export class ObtenerPdfDocumentoUseCase {
  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
    @Inject(ALMACEN_PDF) private readonly almacen: AlmacenPdfPort,
  ) {}

  async ejecutar(id: string): Promise<PdfDescargable> {
    const documento = await this.repo.buscarPorId(id);
    if (!documento) throw new NotFoundException(`Documento ${id} no encontrado`);

    const pdf = documento.getPdf();
    if (pdf.estado !== 'GENERADO' || !pdf.storageKey) {
      const detalle =
        pdf.estado === 'ERROR'
          ? `La generación falló: ${pdf.error ?? 'motivo desconocido'}. Se puede reintentar.`
          : pdf.estado
            ? `Estado del PDF: ${pdf.estado}.`
            : 'Aún no se pidió su generación.';
      throw new ConflictException(`El PDF del documento ${documento.codigo} todavía no está generado. ${detalle}`);
    }

    const contenido = await this.almacen.obtener(pdf.storageKey);
    if (!contenido) {
      throw new NotFoundException(`El archivo del PDF del documento ${documento.codigo} no se encontró en el almacenamiento`);
    }

    if (!pdf.sha256) {
      throw new PdfIntegridadException(
        id,
        `El PDF del documento ${documento.codigo} no tiene huella SHA-256 registrada: no se puede verificar su integridad y no se entrega`,
      );
    }
    const huellaActual = createHash('sha256').update(contenido).digest('hex');
    if (huellaActual !== pdf.sha256) {
      throw new PdfIntegridadException(
        id,
        `El PDF almacenado del documento ${documento.codigo} no coincide con su huella SHA-256 registrada: el archivo fue alterado o está corrupto y no se entrega`,
      );
    }
    return { contenido, nombreArchivo: `${documento.codigo}.pdf` };
  }
}
