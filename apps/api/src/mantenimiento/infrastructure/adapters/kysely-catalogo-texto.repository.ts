import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { KYSELY_DATABASE } from '../../../database/database.module';
import { CatalogoTexto } from '../../domain/catalogo-texto';
import { CatalogoTextoRepository } from '../../domain/ports/catalogo-texto.repository';

@Injectable()
export class KyselyCatalogoTextoRepository implements CatalogoTextoRepository {
  constructor(
    @Inject(KYSELY_DATABASE)
    private readonly db: Kysely<GaferDatabase>,
  ) {}

  async buscarPorId(id: string): Promise<CatalogoTexto | null> {
    const row = await this.db
      .selectFrom('catalogos_texto')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;

    const items = Array.isArray(row.items)
      ? (row.items as string[])
      : JSON.parse((row.items as unknown as string) || '[]');

    return new CatalogoTexto(row.id, row.titulo, items, row.solo_administrador);
  }

  async listar(): Promise<CatalogoTexto[]> {
    const rows = await this.db
      .selectFrom('catalogos_texto')
      .selectAll()
      .orderBy('id', 'asc')
      .execute();

    return rows.map((row) => {
      const items = Array.isArray(row.items)
        ? (row.items as string[])
        : JSON.parse((row.items as unknown as string) || '[]');
      return new CatalogoTexto(row.id, row.titulo, items, row.solo_administrador);
    });
  }

  async guardar(catalogo: CatalogoTexto): Promise<void> {
    await this.db
      .insertInto('catalogos_texto')
      .values({
        id: catalogo.id,
        titulo: catalogo.titulo,
        items: JSON.stringify(catalogo.items) as any,
        solo_administrador: catalogo.soloAdministrador,
        updated_at: new Date() as any,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          items: JSON.stringify(catalogo.items) as any,
          updated_at: new Date() as any,
        }),
      )
      .execute();
  }
}
