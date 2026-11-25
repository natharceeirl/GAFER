import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql, Transaction } from 'kysely';
import { KYSELY_DATABASE } from '../../../database/database.module';
import { GaferDatabase } from '../../../database/types';
import {
  ContextoTransaccional,
  NumeradorCorrelativoPort,
  TipoDocumento,
} from '../../domain/ports/numerador-correlativo.port';

/**
 * Numeración atómica en Postgres (GAF-49). Cada número sale de un
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` sobre el contador (funciones SQL de 001 y 005):
 * la fila del contador queda bloqueada hasta cerrar la transacción, así que las llamadas simultáneas
 * se serializan sin repetir números y, dentro de la transacción del documento, sin dejar huecos.
 *
 *  - INFORME y REPORTE: contador por cliente y tipo. Nunca se reinicia por año.
 *  - CERTIFICADO: una única secuencia global, jamás repetida entre clientes.
 */
@Injectable()
export class KyselyNumeradorCorrelativo implements NumeradorCorrelativoPort {
  constructor(@Inject(KYSELY_DATABASE) private readonly db: Kysely<GaferDatabase>) {}

  async siguienteNumero(clienteId: string, tipo: TipoDocumento, contexto?: ContextoTransaccional): Promise<number> {
    const ejecutor = (contexto as Transaction<GaferDatabase> | undefined) ?? this.db;
    const consulta =
      tipo === 'CERTIFICADO'
        ? sql<{ numero: number }>`SELECT fn_siguiente_correlativo_global(${tipo}) AS numero`
        : sql<{ numero: number }>`SELECT fn_siguiente_correlativo(${clienteId}::uuid, ${tipo}) AS numero`;
    const { rows } = await consulta.execute(ejecutor);
    return Number(rows[0].numero);
  }
}
