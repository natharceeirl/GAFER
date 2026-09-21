import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { Personal, CargoPersonal } from '../../domain/personal';
import { EstadoGeneral } from '../../domain/cliente';
import { PersonalRepository } from '../../domain/ports/personal.repository';

@Injectable()
export class KyselyPersonalRepository implements PersonalRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(personal: Personal): Promise<void> {
    await this.db
      .insertInto('personal')
      .values({
        id: personal.id,
        dni: personal.dni,
        nombres: personal.nombres,
        apellidos: personal.apellidos,
        cargo: personal.cargo,
        telefono: personal.telefono,
        usuario: personal.usuario,
        estado: personal.getEstado(),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          nombres: personal.nombres,
          apellidos: personal.apellidos,
          cargo: personal.cargo,
          telefono: personal.telefono,
          usuario: personal.usuario,
          estado: personal.getEstado(),
        }),
      )
      .execute();
  }

  async buscarPorId(id: string): Promise<Personal | null> {
    const row = await this.db
      .selectFrom('personal')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorDni(dni: string): Promise<Personal | null> {
    const row = await this.db
      .selectFrom('personal')
      .selectAll()
      .where('dni', '=', dni)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorUsuario(usuario: string): Promise<Personal | null> {
    const row = await this.db
      .selectFrom('personal')
      .selectAll()
      .where('usuario', '=', usuario.toUpperCase())
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async listarActivos(): Promise<Personal[]> {
    const rows = await this.db
      .selectFrom('personal')
      .selectAll()
      .where('estado', '=', 'ACTIVO')
      .orderBy('apellidos', 'asc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): Personal {
    return new Personal({
      id: row.id,
      dni: row.dni,
      nombres: row.nombres,
      apellidos: row.apellidos,
      cargo: row.cargo as CargoPersonal,
      telefono: row.telefono,
      usuario: row.usuario,
      estado: row.estado as EstadoGeneral,
    });
  }
}
