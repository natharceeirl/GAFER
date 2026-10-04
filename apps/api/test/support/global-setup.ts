/**
 * global-setup.ts
 * Antes de las pruebas: crea la base de pruebas si no existe y le aplica las tablas.
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 */
import { Client } from 'pg';
import { leerMigraciones } from '../../src/database/migrator';
import { assertTestDatabase, TEST_DATABASE_URL } from './config';

/**
 * Se ejecuta una vez antes de toda la suite:
 *  1. Verifica que la base sea de pruebas (`*_test`).
 *  2. La crea si no existe.
 *  3. Aplica todas las migraciones en orden (son idempotentes: usan IF NOT EXISTS).
 *
 * No usa `pnpm db:migrate` a propósito: ese script termina con exit code 1 aunque funcione (BUG-05).
 */
export default async function globalSetup(): Promise<void> {
  const dbName = assertTestDatabase(TEST_DATABASE_URL);

  await crearBaseSiNoExiste(dbName);

  const migraciones = await leerMigraciones('up');

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    for (const migracion of migraciones) {
      await client.query(migracion.sql);
    }
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
