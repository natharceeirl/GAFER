import { ConflictException, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { Inspeccion, EstadoInspeccion } from '../../domain/inspeccion';
import { InspeccionRepository } from '../../domain/ports/inspeccion.repository';

@Injectable()
export class KyselyInspeccionRepository implements InspeccionRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(inspeccion: Inspeccion): Promise<void> {
    if (inspeccion.getEstado() === 'CERRADO') {
      const result = await this.db
        .updateTable('inspecciones')
        .set({
          estado: inspeccion.getEstado(),
          version_sync: inspeccion.getVersionSync(),
          hora_inicio: inspeccion.horaInicio,
          hora_fin: inspeccion.horaFin,
          tecnicos_participantes: JSON.stringify(inspeccion.tecnicosParticipantes),
          snapshot_catalogos: JSON.stringify(inspeccion.getSnapshot()),
        })
        .where('id', '=', inspeccion.id)
        .where('estado', '=', 'BORRADOR')
        .executeTakeFirst();

      if (Number(result.numUpdatedRows ?? 0) === 0) {
        throw new ConflictException(
          'La inspección ya está cerrada y bloqueada contra ediciones',
        );
      }
      return;
    }

    await this.db
      .insertInto('inspecciones')
      .values({
        id: inspeccion.id,
        servicio_id: inspeccion.servicioId,
        codigo_inspeccion: inspeccion.codigoInspeccion,
        estado: inspeccion.getEstado(),
        version_sync: inspeccion.getVersionSync(),
        fecha_ejecucion: inspeccion.fechaEjecucion,
        hora_inicio: inspeccion.horaInicio,
        hora_fin: inspeccion.horaFin,
        tecnicos_participantes: JSON.stringify(inspeccion.tecnicosParticipantes),
        snapshot_catalogos: JSON.stringify(inspeccion.getSnapshot()),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          estado: inspeccion.getEstado(),
          version_sync: inspeccion.getVersionSync(),
          hora_inicio: inspeccion.horaInicio,
          hora_fin: inspeccion.horaFin,
          tecnicos_participantes: JSON.stringify(inspeccion.tecnicosParticipantes),
          snapshot_catalogos: JSON.stringify(inspeccion.getSnapshot()),
        }).where('inspecciones.estado', '=', 'BORRADOR'),
      )
      .execute();
  }

  async buscarPorId(id: string): Promise<Inspeccion | null> {
    const row = await this.db
      .selectFrom('inspecciones')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorServicioId(servicioId: string): Promise<Inspeccion | null> {
    const row = await this.db
      .selectFrom('inspecciones')
      .selectAll()
      .where('servicio_id', '=', servicioId)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async listarPorTecnico(tecnicoId: string): Promise<Inspeccion[]> {
    const rows = await this.db
      .selectFrom('inspecciones')
      .leftJoin('servicios_contratados', 'servicios_contratados.id', 'inspecciones.servicio_id')
      .leftJoin('proyectos', 'proyectos.id', 'servicios_contratados.proyecto_id')
      .leftJoin('clientes', 'clientes.id', 'proyectos.cliente_id')
      .select([
        'inspecciones.id',
        'inspecciones.servicio_id',
        'inspecciones.codigo_inspeccion',
        'inspecciones.estado',
        'inspecciones.version_sync',
        'inspecciones.fecha_ejecucion',
        'inspecciones.hora_inicio',
        'inspecciones.hora_fin',
        'inspecciones.tecnicos_participantes',
        'inspecciones.snapshot_catalogos',
        'clientes.razon_social as cliente_razon_social',
        'proyectos.nombre as sede_nombre',
        'servicios_contratados.tipo_servicio as servicio_tipo',
      ])
      .where('inspecciones.estado', '=', 'CERRADO')
      .where(
        sql<boolean>`inspecciones.tecnicos_participantes @> jsonb_build_array(jsonb_build_object('id', ${tecnicoId}::text))`,
      )
      .orderBy('inspecciones.fecha_ejecucion', 'desc')
      .orderBy('inspecciones.created_at', 'desc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  async listarTodas(): Promise<Inspeccion[]> {
    const rows = await this.db
      .selectFrom('inspecciones')
      .leftJoin('servicios_contratados', 'servicios_contratados.id', 'inspecciones.servicio_id')
      .leftJoin('proyectos', 'proyectos.id', 'servicios_contratados.proyecto_id')
      .leftJoin('clientes', 'clientes.id', 'proyectos.cliente_id')
      .select([
        'inspecciones.id',
        'inspecciones.servicio_id',
        'inspecciones.codigo_inspeccion',
        'inspecciones.estado',
        'inspecciones.version_sync',
        'inspecciones.fecha_ejecucion',
        'inspecciones.hora_inicio',
        'inspecciones.hora_fin',
        'inspecciones.tecnicos_participantes',
        'inspecciones.snapshot_catalogos',
        'clientes.razon_social as cliente_razon_social',
        'proyectos.nombre as sede_nombre',
        'servicios_contratados.tipo_servicio as servicio_tipo',
      ])
      .where('inspecciones.estado', '=', 'CERRADO')
      .orderBy('inspecciones.fecha_ejecucion', 'desc')
      .orderBy('inspecciones.created_at', 'desc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  private formatFecha(val: unknown): string {
    if (!val) return '';
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    const str = String(val);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return str;
  }

  private formatHora(val: unknown): string | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str) return null;
    const match = str.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    return str;
  }

  private mapToDomain(row: any): Inspeccion {
    const snapshotCatalogos =
      typeof row.snapshot_catalogos === 'string'
        ? JSON.parse(row.snapshot_catalogos)
        : (row.snapshot_catalogos ?? {});

    const tecnicos =
      typeof row.tecnicos_participantes === 'string'
        ? JSON.parse(row.tecnicos_participantes)
        : (row.tecnicos_participantes ?? []);

    return new Inspeccion({
      id: row.id,
      servicioId: row.servicio_id,
      codigoInspeccion: row.codigo_inspeccion,
      estado: row.estado as EstadoInspeccion,
      versionSync: row.version_sync,
      fechaEjecucion: this.formatFecha(row.fecha_ejecucion),
      horaInicio: this.formatHora(row.hora_inicio),
      horaFin: this.formatHora(row.hora_fin),
      tecnicosParticipantes: tecnicos,
      snapshotCatalogos,
      clienteRazonSocial: row.cliente_razon_social ?? undefined,
      sedeNombre: row.sede_nombre ?? undefined,
      servicioTipo: row.servicio_tipo ?? undefined,
    });
  }
}
