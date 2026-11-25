import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql, Transaction } from 'kysely';
import { KYSELY_DATABASE } from '../../../database/database.module';
import { GaferDatabase } from '../../../database/types';
import { Documento } from '../../domain/documento';
import {
  DocumentoDetalleLectura,
  DocumentoRepository,
  DocumentoResumenLectura,
  FiltroDocumentos,
} from '../../domain/ports/documento.repository';
import { ContextoTransaccional } from '../../domain/ports/numerador-correlativo.port';

type Ejecutor = Kysely<GaferDatabase> | Transaction<GaferDatabase>;

@Injectable()
export class KyselyDocumentoRepository implements DocumentoRepository {
  constructor(@Inject(KYSELY_DATABASE) private readonly db: Kysely<GaferDatabase>) {}

  private ejecutor(contexto?: ContextoTransaccional): Ejecutor {
    return (contexto as Transaction<GaferDatabase> | undefined) ?? this.db;
  }

  async guardar(documento: Documento, contexto?: ContextoTransaccional): Promise<void> {
    const guardarEn = async (ex: Ejecutor) => {
      await ex
        .insertInto('documentos')
        .values({
          id: documento.id,
          cliente_id: documento.clienteId,
          proyecto_id: documento.proyectoId,
          inspeccion_id: null,
          tipo: documento.tipo,
          codigo: documento.codigo,
          numero_correlativo: documento.numeroCorrelativo,
          estado: documento.getEstado(),
          fecha: sql<Date>`(now() at time zone 'America/Lima')::date`,
          creado_por_id: documento.creadoPor?.id ?? null,
          creado_por_usuario: documento.creadoPor?.usuario ?? null,
        })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet({
            estado: documento.getEstado(),
            pdf_estado: documento.getPdf().estado,
            pdf_storage_key: documento.getPdf().storageKey,
            pdf_generado_at: documento.getPdf().generadoAt,
            pdf_error: documento.getPdf().error,
            pdf_intentos: documento.getPdf().intentos,
            updated_at: sql<Date>`now()`,
          }),
        )
        .execute();

      const pendientes = documento.vaciarTransicionesPendientes();
      if (pendientes.length > 0) {
        await ex
          .insertInto('documentos_transiciones')
          .values(
            pendientes.map((t) => ({
              documento_id: documento.id,
              estado_anterior: t.estadoAnterior,
              estado_nuevo: t.estadoNuevo,
              actor_id: t.actor.id,
              actor_usuario: t.actor.usuario,
              actor_rol: t.actor.rol,
              motivo: t.motivo,
              created_at: t.fecha,
            })),
          )
          .execute();
      }
    };

    // Sin contexto externo, documento y transiciones se guardan juntos en su propia transacción.
    if (contexto) await guardarEn(this.ejecutor(contexto));
    else await this.db.transaction().execute(guardarEn);
  }

  async buscarPorId(id: string, contexto?: ContextoTransaccional): Promise<Documento | null> {
    let consulta = this.ejecutor(contexto).selectFrom('documentos').selectAll().where('id', '=', id);
    if (contexto) consulta = consulta.forUpdate();
    const fila = await consulta.executeTakeFirst();
    if (!fila) return null;
    return new Documento(fila.id, fila.cliente_id, fila.numero_correlativo, {
      tipo: fila.tipo,
      codigo: fila.codigo,
      estado: fila.estado,
      proyectoId: fila.proyecto_id,
      fecha: fila.fecha,
      pdf: {
        estado: fila.pdf_estado,
        storageKey: fila.pdf_storage_key,
        generadoAt: fila.pdf_generado_at,
        error: fila.pdf_error,
        intentos: fila.pdf_intentos,
      },
      creadoPor: fila.creado_por_usuario ? { id: fila.creado_por_id, usuario: fila.creado_por_usuario, rol: '' } : null,
    });
  }

  async listar(filtro: FiltroDocumentos): Promise<DocumentoResumenLectura[]> {
    let consulta = this.consultaResumen();
    if (filtro.estado) consulta = consulta.where('d.estado', '=', filtro.estado);
    if (filtro.tipo) consulta = consulta.where('d.tipo', '=', filtro.tipo);
    if (filtro.clienteId) consulta = consulta.where('d.cliente_id', '=', filtro.clienteId);
    return consulta.orderBy('d.created_at', 'desc').orderBy('d.id').execute();
  }

  async obtenerDetalle(id: string): Promise<DocumentoDetalleLectura | null> {
    const resumen = await this.consultaResumen().where('d.id', '=', id).executeTakeFirst();
    if (!resumen) return null;
    const pdf = await this.db
      .selectFrom('documentos')
      .select(['pdf_estado', 'pdf_generado_at', 'pdf_error'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const filas = await this.db
      .selectFrom('documentos_transiciones')
      .selectAll()
      .where('documento_id', '=', id)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute();
    return {
      ...resumen,
      pdf: { estado: pdf.pdf_estado, generadoAt: pdf.pdf_generado_at?.toISOString() ?? null, error: pdf.pdf_error },
      transiciones: filas.map((f) => ({
        estadoAnterior: f.estado_anterior,
        estadoNuevo: f.estado_nuevo,
        actorId: f.actor_id,
        actorUsuario: f.actor_usuario,
        actorRol: f.actor_rol,
        motivo: f.motivo,
        fecha: f.created_at.toISOString(),
      })),
    };
  }

  private consultaResumen() {
    return this.db
      .selectFrom('documentos as d')
      .innerJoin('clientes as c', 'c.id', 'd.cliente_id')
      .leftJoin('proyectos as p', 'p.id', 'd.proyecto_id')
      .select([
        'd.id as id',
        'd.codigo as codigo',
        'd.cliente_id as clienteId',
        'c.razon_social as cliente',
        'p.nombre as proyecto',
        'd.tipo as tipo',
        'd.numero_correlativo as numeroCorrelativo',
        'd.estado as estado',
        sql<string>`to_char(d.fecha, 'YYYY-MM-DD')`.as('fecha'),
      ]);
  }
}
