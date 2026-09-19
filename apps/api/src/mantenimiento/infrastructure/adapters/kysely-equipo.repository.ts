import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { Equipo, TipoEquipo, EstadoOperativoEquipo } from '../../domain/equipo';
import { EquipoRepository } from '../../domain/ports/equipo.repository';

@Injectable()
export class KyselyEquipoRepository implements EquipoRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(equipo: Equipo): Promise<void> {
    await this.db
      .insertInto('equipos')
      .values({
        id: equipo.id,
        codigo_interno: equipo.codigoInterno,
        nombre: equipo.nombre,
        tipo: equipo.tipo,
        marca_modelo: equipo.marcaModelo,
        estado_operativo: equipo.getEstadoOperativo(),
        fecha_adquisicion: equipo.fechaAdquisicion,
        ultimo_mantenimiento: equipo.ultimoMantenimiento,
        proximo_mantenimiento: equipo.proximoMantenimiento,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          codigo_interno: equipo.codigoInterno,
          nombre: equipo.nombre,
          tipo: equipo.tipo,
          marca_modelo: equipo.marcaModelo,
          estado_operativo: equipo.getEstadoOperativo(),
          fecha_adquisicion: equipo.fechaAdquisicion,
          ultimo_mantenimiento: equipo.ultimoMantenimiento,
          proximo_mantenimiento: equipo.proximoMantenimiento,
        }),
      )
      .execute();
  }

  async buscarPorId(id: string): Promise<Equipo | null> {
    const row = await this.db
      .selectFrom('equipos')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorCodigoInterno(codigoInterno: string): Promise<Equipo | null> {
    const row = await this.db
      .selectFrom('equipos')
      .selectAll()
      .where('codigo_interno', '=', codigoInterno)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async listarOperativos(): Promise<Equipo[]> {
    const rows = await this.db
      .selectFrom('equipos')
      .selectAll()
      .where('estado_operativo', '=', 'OPERATIVO')
      .orderBy('nombre', 'asc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  async listarTodos(): Promise<Equipo[]> {
    const rows = await this.db
      .selectFrom('equipos')
      .selectAll()
      .orderBy('codigo_interno', 'asc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): Equipo {
    return new Equipo({
      id: row.id,
      codigoInterno: row.codigo_interno,
      nombre: row.nombre,
      tipo: row.tipo as TipoEquipo,
      marcaModelo: row.marca_modelo,
      estadoOperativo: row.estado_operativo as EstadoOperativoEquipo,
      fechaAdquisicion: row.fecha_adquisicion ? String(row.fecha_adquisicion) : null,
      ultimoMantenimiento: row.ultimo_mantenimiento ? String(row.ultimo_mantenimiento) : null,
      proximoMantenimiento: row.proximo_mantenimiento ? String(row.proximo_mantenimiento) : null,
    });
  }
}
