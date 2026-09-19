import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { GaferDatabase } from './types';

// Cargar variables de entorno locales de apps/api
dotenv.config();

export function createDatabasePool(): Pool {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'gafer',
    password: process.env.POSTGRES_PASSWORD || 'gafer',
    database: process.env.POSTGRES_DB || 'gafer',
  });
}

export function createKyselyDatabase(pool?: Pool): Kysely<GaferDatabase> {
  const activePool = pool || createDatabasePool();
  return new Kysely<GaferDatabase>({
    dialect: new PostgresDialect({
      pool: activePool,
    }),
  });
}
