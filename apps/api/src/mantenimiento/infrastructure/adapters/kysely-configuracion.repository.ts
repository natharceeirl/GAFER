import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../../database/types';
import { KYSELY_DATABASE } from '../../../database/database.module';
import { ConfiguracionSistema } from '../../domain/configuracion-sistema';
import { ConfiguracionRepository } from '../../domain/ports/configuracion.repository';

@Injectable()
export class KyselyConfiguracionRepository implements ConfiguracionRepository {
  constructor(
    @Inject(KYSELY_DATABASE)
    private readonly db: Kysely<GaferDatabase>,
  ) {}

  async obtener(): Promise<ConfiguracionSistema> {
    const row = await this.db
      .selectFrom('configuracion_sistema')
      .selectAll()
      .where('id', '=', 'global')
      .executeTakeFirst();

    if (!row) {
      return new ConfiguracionSistema();
    }

    const parametros =
      typeof row.parametros === 'string'
        ? JSON.parse(row.parametros)
        : (row.parametros as Record<string, unknown>) ?? {};

    return new ConfiguracionSistema(
      row.id,
      row.director_nombre,
      row.director_cip,
      row.director_firma,
      row.resolucion_sanitaria,
      parametros,
      row.actualizado_por,
      row.updated_at,
    );
  }

  async guardar(config: ConfiguracionSistema): Promise<void> {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const actualizadoPor =
      config.actualizadoPor && UUID_REGEX.test(config.actualizadoPor)
        ? config.actualizadoPor
        : null;

    await this.db
      .insertInto('configuracion_sistema')
      .values({
        id: config.id,
        director_nombre: config.directorNombre,
        director_cip: config.directorCip,
        director_firma: config.directorFirma,
        resolucion_sanitaria: config.resolucionSanitaria,
        parametros: JSON.stringify(config.parametros) as any,
        actualizado_por: actualizadoPor,
        updated_at: new Date() as any,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          director_nombre: config.directorNombre,
          director_cip: config.directorCip,
          director_firma: config.directorFirma,
          resolucion_sanitaria: config.resolucionSanitaria,
          parametros: JSON.stringify(config.parametros) as any,
          actualizado_por: actualizadoPor,
          updated_at: new Date() as any,
        }),
      )
      .execute();
  }
}
