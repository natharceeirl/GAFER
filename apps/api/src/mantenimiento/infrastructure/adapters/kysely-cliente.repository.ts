import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { Cliente, EstadoGeneral } from '../../domain/cliente';
import { ClienteRepository } from '../../domain/ports/cliente.repository';

@Injectable()
export class KyselyClienteRepository implements ClienteRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async guardar(cliente: Cliente): Promise<void> {
    await this.db
      .insertInto('clientes')
      .values({
        id: cliente.id,
        razon_social: cliente.razonSocial,
        ruc: cliente.ruc,
        codigo_corto: cliente.codigoCorto,
        direccion_fiscal: cliente.direccionFiscal,
        giro_negocio: cliente.giroNegocio,
        contacto_nombre: cliente.contactoNombre,
        contacto_cargo: cliente.contactoCargo,
        contacto_telefono: cliente.contactoTelefono,
        contacto_correo: cliente.contactoCorreo,
        estado: cliente.getEstado(),
        campos_extra: JSON.stringify(cliente.camposExtra),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          razon_social: cliente.razonSocial,
          direccion_fiscal: cliente.direccionFiscal,
          giro_negocio: cliente.giroNegocio,
          contacto_nombre: cliente.contactoNombre,
          contacto_cargo: cliente.contactoCargo,
          contacto_telefono: cliente.contactoTelefono,
          contacto_correo: cliente.contactoCorreo,
          estado: cliente.getEstado(),
          campos_extra: JSON.stringify(cliente.camposExtra),
        }),
      )
      .execute();
  }

  async buscarPorId(id: string): Promise<Cliente | null> {
    const row = await this.db
      .selectFrom('clientes')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorRuc(ruc: string): Promise<Cliente | null> {
    const row = await this.db
      .selectFrom('clientes')
      .selectAll()
      .where('ruc', '=', ruc)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorCodigoCorto(codigoCorto: string): Promise<Cliente | null> {
    const row = await this.db
      .selectFrom('clientes')
      .selectAll()
      .where('codigo_corto', '=', codigoCorto)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async listarTodos(): Promise<Cliente[]> {
    const rows = await this.db
      .selectFrom('clientes')
      .selectAll()
      .orderBy('razon_social', 'asc')
      .execute();

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): Cliente {
    const camposExtra =
      typeof row.campos_extra === 'string'
        ? JSON.parse(row.campos_extra)
        : (row.campos_extra ?? {});

    return new Cliente({
      id: row.id,
      razonSocial: row.razon_social,
      ruc: row.ruc,
      codigoCorto: row.codigo_corto,
      direccionFiscal: row.direccion_fiscal,
      giroNegocio: row.giro_negocio,
      contactoNombre: row.contacto_nombre,
      contactoCargo: row.contacto_cargo,
      contactoTelefono: row.contacto_telefono,
      contactoCorreo: row.contacto_correo,
      estado: row.estado as EstadoGeneral,
      camposExtra,
    });
  }
}
