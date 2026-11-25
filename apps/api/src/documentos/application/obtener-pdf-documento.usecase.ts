import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import { ALMACEN_PDF, AlmacenPdfPort } from '../domain/ports/pdf.ports';

export interface PdfDescargable {
  contenido: Buffer;
  nombreArchivo: string;
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
    return { contenido, nombreArchivo: `${documento.codigo}.pdf` };
  }
}
