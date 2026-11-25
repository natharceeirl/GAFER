import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Transaction } from 'kysely';
import { KYSELY_DATABASE } from '../../../database/database.module';
import { GaferDatabase } from '../../../database/types';
import { ClienteCodigoPort } from '../../domain/ports/cliente-codigo.port';
import { ContextoTransaccional } from '../../domain/ports/numerador-correlativo.port';

@Injectable()
export class KyselyClienteCodigo implements ClienteCodigoPort {
  constructor(@Inject(KYSELY_DATABASE) private readonly db: Kysely<GaferDatabase>) {}

  async buscarCodigoCorto(clienteId: string, contexto?: ContextoTransaccional): Promise<string | null> {
    const ejecutor = (contexto as Transaction<GaferDatabase> | undefined) ?? this.db;
    const fila = await ejecutor
      .selectFrom('clientes')
      .select('codigo_corto')
      .where('id', '=', clienteId)
      .executeTakeFirst();
    return fila?.codigo_corto ?? null;
  }
}
