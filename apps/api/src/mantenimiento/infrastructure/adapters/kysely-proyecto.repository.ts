import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { Proyecto } from '../../domain/proyecto';
import { EstadoGeneral } from '../../domain/cliente';
import { ProyectoRepository } from '../../domain/ports/proyecto.repository';

@Injectable()
export class KyselyProyectoRepository implements ProyectoRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(proyecto: Proyecto): Promise<void> {
    await this.db
      .insertInto('proyectos')
      .values({
        id: proyecto.id,
        cliente_id: proyecto.clienteId,
        nombre: proyecto.nombre,
        direccion_sede: proyecto.direccionSede,
        distrito: proyecto.distrito,
        provincia: proyecto.provincia,
        departamento: proyecto.departamento,
        contacto_nombre: proyecto.contactoNombre,
        contacto_cargo: proyecto.contactoCargo,
        contacto_telefono: proyecto.contactoTelefono,
        estado: proyecto.getEstado(),
        observaciones: proyecto.observaciones,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          nombre: proyecto.nombre,
          direccion_sede: proyecto.direccionSede,
          distrito: proyecto.distrito,
          provincia: proyecto.provincia,
          departamento: proyecto.departamento,
          contacto_nombre: proyecto.contactoNombre,
          contacto_cargo: proyecto.contactoCargo,
          contacto_telefono: proyecto.contactoTelefono,
          estado: proyecto.getEstado(),
          observaciones: proyecto.observaciones,
        }),
      )
      .execute();
  }

  async buscarPorId(id: string): Promise<Proyecto | null> {
    const row = await this.db
      .selectFrom('proyectos')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorClienteId(clienteId: string): Promise<Proyecto[]> {
    const rows = await this.db
      .selectFrom('proyectos')
      .selectAll()
      .where('cliente_id', '=', clienteId)
      .orderBy('nombre', 'asc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  async buscarPorClienteYNombre(clienteId: string, nombre: string): Promise<Proyecto | null> {
    const row = await this.db
      .selectFrom('proyectos')
      .selectAll()
      .where('cliente_id', '=', clienteId)
      .where('nombre', '=', nombre)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  private mapToDomain(row: any): Proyecto {
    return new Proyecto({
      id: row.id,
      clienteId: row.cliente_id,
      nombre: row.nombre,
      direccionSede: row.direccion_sede,
      distrito: row.distrito,
      provincia: row.provincia,
      departamento: row.departamento,
      contactoNombre: row.contacto_nombre,
      contactoCargo: row.contacto_cargo,
      contactoTelefono: row.contacto_telefono,
      estado: row.estado as EstadoGeneral,
      observaciones: row.observaciones,
    });
  }
}
