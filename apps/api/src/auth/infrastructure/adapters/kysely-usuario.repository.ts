import { Injectable, Optional } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/usuario';
import { CargoPersonal } from '@gafer/contracts';

@Injectable()
export class KyselyUsuarioRepository implements UsuarioRepository {
  // Semillas oficiales según Spec §12 y ROLES_MOCK
  private readonly usuariosSemilla: Map<string, Usuario> = new Map([
    [
      'R.AGARATE',
      new Usuario(
        '11111111-1111-1111-1111-111111111111',
        '10000001',
        'Roberto',
        'Agarate',
        'ADMINISTRADOR',
        '958000001',
        'R.AGARATE',
        Usuario.generarHashPassword('Admin123!'),
        'ACTIVO',
      ),
    ],
    [
      'D.AMAMANI',
      new Usuario(
        '22222222-2222-2222-2222-222222222222',
        '10000002',
        'Daniel',
        'Amamani',
        'SUPERVISOR',
        '958000002',
        'D.AMAMANI',
        Usuario.generarHashPassword('Super123!'),
        'ACTIVO',
      ),
    ],
    [
      'J.PEREZ',
      new Usuario(
        '33333333-3333-3333-3333-333333333333',
        '10000003',
        'Juan',
        'Perez',
        'TECNICO_OPERADOR',
        '958000003',
        'J.PEREZ',
        Usuario.generarHashPassword('Tecnico123!'),
        'ACTIVO',
      ),
    ],
  ]);

  constructor(@Optional() private readonly db?: Kysely<GaferDatabase>) {}

  async buscarPorUsuario(username: string): Promise<Usuario | null> {
    if (!username) return null;
    const clave = username.trim().toUpperCase();

    // 1. Buscar en semillas oficiales
    if (this.usuariosSemilla.has(clave)) {
      return this.usuariosSemilla.get(clave)!;
    }

    // 2. Si hay conexión a BD, consultar tabla personal
    if (this.db) {
      try {
        const row = await this.db
          .selectFrom('personal')
          .selectAll()
          .where('usuario', '=', clave)
          .executeTakeFirst();

        if (row) {
          // Por defecto la clave inicial es Gafer2026! o el mismo nombre de usuario
          return new Usuario(
            row.id,
            row.dni,
            row.nombres,
            row.apellidos,
            row.cargo as CargoPersonal,
            row.telefono,
            row.usuario || clave,
            Usuario.generarHashPassword('Gafer2026!'),
            row.estado as 'ACTIVO' | 'INACTIVO',
          );
        }
      } catch {
        // En entornos aislados sin BD activa, continuar con fallback
      }
    }

    return null;
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    if (!id) return null;

    for (const u of this.usuariosSemilla.values()) {
      if (u.id === id) return u;
    }

    if (this.db) {
      try {
        const row = await this.db
          .selectFrom('personal')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();

        if (row) {
          return new Usuario(
            row.id,
            row.dni,
            row.nombres,
            row.apellidos,
            row.cargo as CargoPersonal,
            row.telefono,
            row.usuario || id,
            Usuario.generarHashPassword('Gafer2026!'),
            row.estado as 'ACTIVO' | 'INACTIVO',
          );
        }
      } catch {
        // Fallback
      }
    }

    return null;
  }
}
