import { Injectable } from '@nestjs/common';
import { Documento } from '../domain/documento';
import {
  DocumentoDetalleLectura,
  DocumentoRepository,
  DocumentoResumenLectura,
  FiltroDocumentos,
  TransicionLectura,
} from '../domain/ports/documento.repository';

/** Solo para pruebas unitarias. La aplicación usa `KyselyDocumentoRepository`. */
@Injectable()
export class DocumentoRepositoryMemory implements DocumentoRepository {
  private readonly store = new Map<string, Documento>();
  private readonly historial = new Map<string, TransicionLectura[]>();

  async guardar(documento: Documento): Promise<void> {
    this.store.set(documento.id, documento);
    const lista = this.historial.get(documento.id) ?? [];
    for (const t of documento.vaciarTransicionesPendientes()) {
      lista.push({
        estadoAnterior: t.estadoAnterior,
        estadoNuevo: t.estadoNuevo,
        actorId: t.actor.id,
        actorUsuario: t.actor.usuario,
        actorRol: t.actor.rol,
        motivo: t.motivo,
        fecha: t.fecha.toISOString(),
      });
    }
    this.historial.set(documento.id, lista);
  }

  async buscarPorId(id: string): Promise<Documento | null> {
    return this.store.get(id) ?? null;
  }

  async listar(filtro: FiltroDocumentos): Promise<DocumentoResumenLectura[]> {
    return [...this.store.values()]
      .filter((d) => (!filtro.estado || d.getEstado() === filtro.estado) && (!filtro.tipo || d.tipo === filtro.tipo))
      .filter((d) => !filtro.clienteId || d.clienteId === filtro.clienteId)
      .map((d) => this.resumen(d));
  }

  async obtenerDetalle(id: string): Promise<DocumentoDetalleLectura | null> {
    const doc = this.store.get(id);
    if (!doc) return null;
    const pdf = doc.getPdf();
    return {
      ...this.resumen(doc),
      transiciones: [...(this.historial.get(id) ?? [])],
      pdf: { estado: pdf.estado, generadoAt: pdf.generadoAt?.toISOString() ?? null, error: pdf.error },
    };
  }

  private resumen(d: Documento): DocumentoResumenLectura {
    return {
      id: d.id,
      codigo: d.codigo,
      clienteId: d.clienteId,
      cliente: d.clienteId,
      proyecto: null,
      tipo: d.tipo,
      numeroCorrelativo: d.numeroCorrelativo,
      estado: d.getEstado(),
      fecha: (d.fecha ?? new Date()).toISOString().slice(0, 10),
    };
  }
}
