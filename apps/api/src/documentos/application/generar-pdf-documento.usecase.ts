import { createHash } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { clavePdfDocumento } from '../domain/documento';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import {
  ALMACEN_PDF,
  AlmacenPdfPort,
  DOCUMENTO_PDF_DATOS,
  DocumentoPdfDatosPort,
  PDF_RENDERER,
  PdfRendererPort,
} from '../domain/ports/pdf.ports';
import { TRANSACCION, TransaccionPort } from '../domain/ports/transaccion.port';

/** Lo ejecuta `apps/worker` al sacar un trabajo de la cola. No se registra en el módulo HTTP. */
@Injectable()
export class GenerarPdfDocumentoUseCase {
  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
    @Inject(TRANSACCION) private readonly transaccion: TransaccionPort,
    @Inject(DOCUMENTO_PDF_DATOS) private readonly datos: DocumentoPdfDatosPort,
    @Inject(PDF_RENDERER) private readonly renderer: PdfRendererPort,
    @Inject(ALMACEN_PDF) private readonly almacen: AlmacenPdfPort,
  ) {}

  /**
   * Idempotente: un trabajo repetido sobre un PDF ya generado no vuelve a renderizar; el PDF emitido es
   * inmutable (GAF-56) y nadie puede dejarlo otra vez en PENDIENTE. Un fallo deja ERROR con el motivo y se propaga
   * para que la cola reintente; nunca se traga.
   */
  async ejecutar(id: string): Promise<void> {
    const debeGenerar = await this.transaccion.ejecutar(async (contexto) => {
      const documento = await this.repo.buscarPorId(id, contexto);
      if (!documento) throw new NotFoundException(`Documento ${id} no encontrado`);
      if (documento.getPdf().estado === 'GENERADO') return false;
      documento.iniciarGeneracionPdf();
      await this.repo.guardar(documento, contexto);
      return true;
    });
    if (!debeGenerar) return;

    try {
      const datos = await this.datos.cargar(id);
      if (!datos) throw new Error(`Documento ${id}: no se encontraron los datos para armar el PDF`);
      const contenido = await this.renderer.renderizar(datos);
      const clave = clavePdfDocumento(id, datos.documento.codigo);
      await this.almacen.guardar(clave, contenido);
      // La huella se calcula sobre los mismos bytes que se guardan (GAF-56): es lo que se verifica al servir.
      const sha256 = createHash('sha256').update(contenido).digest('hex');
      await this.registrar(id, (documento) => documento.marcarPdfGenerado(clave, new Date(), sha256));
    } catch (error) {
      await this.registrar(id, (documento) => documento.marcarPdfFallido(mensajeDe(error)));
      throw error;
    }
  }

  private async registrar(id: string, cambio: (documento: NonNullable<Awaited<ReturnType<DocumentoRepository['buscarPorId']>>>) => void) {
    await this.transaccion.ejecutar(async (contexto) => {
      const documento = await this.repo.buscarPorId(id, contexto);
      if (!documento) throw new NotFoundException(`Documento ${id} no encontrado`);
      cambio(documento);
      await this.repo.guardar(documento, contexto);
    });
  }
}

function mensajeDe(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  return texto.slice(0, 500);
}
