import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { Inspeccion, EstadoInspeccion } from '../../domain/inspeccion';
import { InspeccionRepository } from '../../domain/ports/inspeccion.repository';

@Injectable()
export class KyselyInspeccionRepository implements InspeccionRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(inspeccion: Inspeccion): Promise<void> {
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
        }),
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
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
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
      horaInicio: row.hora_inicio ? String(row.hora_inicio) : null,
      horaFin: row.hora_fin ? String(row.hora_fin) : null,
      tecnicosParticipantes: tecnicos,
      snapshotCatalogos,
    });
  }
}
