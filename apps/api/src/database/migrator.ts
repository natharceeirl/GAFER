import * as fs from 'fs/promises';
import * as path from 'path';
import { sql } from 'kysely';
import { createKyselyDatabase, createDatabasePool } from './connection';

export type DireccionMigracion = 'up' | 'down';

export interface Migracion {
  nombre: string;
  sql: string;
}

/** Carpeta `infra/migrations` de la raíz del monorepo (este archivo vive en apps/api/{src,dist}/database). */
export function directorioMigraciones(): string {
  return path.resolve(__dirname, '../../../../infra/migrations');
}

/**
 * Lee las migraciones numeradas (`NNN_nombre.up.sql` / `NNN_nombre.down.sql`).
 * UP en orden creciente; DOWN en orden inverso, para deshacer primero lo último que se agregó.
 * Todas las migraciones son idempotentes (`IF NOT EXISTS` / `IF EXISTS`), así que se pueden reaplicar.
 */
export async function leerMigraciones(
  direccion: DireccionMigracion,
  directorio: string = directorioMigraciones(),
): Promise<Migracion[]> {
  const patron = new RegExp(`^\\d{3}_.+\\.${direccion}\\.sql$`);
  const nombres = (await fs.readdir(directorio)).filter((nombre) => patron.test(nombre)).sort();
  if (direccion === 'down') nombres.reverse();

  return Promise.all(
    nombres.map(async (nombre) => ({
      nombre,
      sql: await fs.readFile(path.join(directorio, nombre), 'utf-8'),
    })),
  );
}

export async function runMigration(direction: DireccionMigracion): Promise<void> {
  const pool = createDatabasePool();
  const db = createKyselyDatabase(pool);

  try {
    for (const migracion of await leerMigraciones(direction)) {
      console.log(`[GAFER-MIGRATOR] Ejecutando migración ${direction.toUpperCase()}: ${migracion.nombre}`);
      // Ejecutar en bloque SQL
      await sql.raw(migracion.sql).execute(db);
    }

    console.log(`[GAFER-MIGRATOR] Migración ${direction.toUpperCase()} completada exitosamente.`);
  } catch (error) {
    console.error(`[GAFER-MIGRATOR] Error ejecutando migración ${direction.toUpperCase()}:`, error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Ejecución directa por CLI
if (require.main === module) {
  const arg = process.argv[2];
  const direction = arg === 'down' ? 'down' : 'up';

  runMigration(direction)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
