import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { KYSELY_DATABASE } from '../../../database/database.module';
import { GaferDatabase } from '../../../database/types';
import { ContextoTransaccional } from '../../domain/ports/numerador-correlativo.port';
import { TransaccionPort } from '../../domain/ports/transaccion.port';

@Injectable()
export class KyselyTransaccion implements TransaccionPort {
  constructor(@Inject(KYSELY_DATABASE) private readonly db: Kysely<GaferDatabase>) {}

  ejecutar<T>(trabajo: (contexto: ContextoTransaccional) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) => trabajo(trx));
  }
}
