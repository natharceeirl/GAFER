import { Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { CargoPersonal } from '@gafer/contracts';
import { GaferDatabase, PersonalTable } from '../../../database/types';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/usuario';

/** Los usuarios son las filas de `personal` con `usuario` y `clave_hash`; no hay usuarios fijos en el código. */
@Injectable()
export class KyselyUsuarioRepository implements UsuarioRepository {
  constructor(private readonly db: Kysely<GaferDatabase>) {}

  async buscarPorUsuario(username: string): Promise<Usuario | null> {
    const usuario = username?.trim().toUpperCase();
    if (!usuario) return null;

    const row = await this.db
      .selectFrom('personal')
      .selectAll()
      .where('usuario', '=', usuario)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    if (!id) return null;

    const row = await this.db
      .selectFrom('personal')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.mapToDomain(row) : null;
  }

  private mapToDomain(row: Selectable<PersonalTable>): Usuario {
    return new Usuario(
      row.id,
      row.dni,
      row.nombres,
      row.apellidos,
      row.cargo as CargoPersonal,
      row.telefono,
      row.usuario ?? '',
      row.clave_hash,
      row.estado,
    );
  }
}
