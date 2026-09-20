import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { assertTestDatabase, TEST_DATABASE_URL } from './config';

/**
 * Se ejecuta una vez antes de toda la suite:
 *  1. Verifica que la base sea de pruebas (`*_test`).
 *  2. La crea si no existe.
 *  3. Aplica la migración inicial (es idempotente: usa CREATE ... IF NOT EXISTS).
 *
 * No usa `pnpm db:migrate` a propósito: ese script termina con exit code 1 aunque funcione (BUG-05).
 */
export default async function globalSetup(): Promise<void> {
  const dbName = assertTestDatabase(TEST_DATABASE_URL);

  await crearBaseSiNoExiste(dbName);

  const migracion = path.resolve(__dirname, '../../../../infra/migrations/001_initial_schema.up.sql');
  const sql = fs.readFileSync(migracion, 'utf-8');

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function crearBaseSiNoExiste(dbName: string): Promise<void> {
  const probe = new Client({ connectionString: TEST_DATABASE_URL });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (error) {
    if ((error as { code?: string }).code !== '3D000') {
      throw new Error(
        `[QA] No se pudo conectar a PostgreSQL con ${TEST_DATABASE_URL}. ` +
          `¿Está corriendo (pnpm infra:up)? Detalle: ${(error as Error).message}`,
      );
    }
  }

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }
}
