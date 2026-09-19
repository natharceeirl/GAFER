import * as fs from 'fs/promises';
import * as path from 'path';
import { sql } from 'kysely';
import { createKyselyDatabase, createDatabasePool } from './connection';

export async function runMigration(direction: 'up' | 'down'): Promise<void> {
  const pool = createDatabasePool();
  const db = createKyselyDatabase(pool);

  const migrationFile =
    direction === 'up'
      ? '001_initial_schema.up.sql'
      : '001_initial_schema.down.sql';

  // Buscar el archivo de migración en infra/migrations
  const migrationPath = path.resolve(
    process.cwd(),
    '../../infra/migrations',
    migrationFile,
  );

  // Fallback si se corre desde la raíz del monorepo
  const resolvedPath = (await fileExists(migrationPath))
    ? migrationPath
    : path.resolve(process.cwd(), 'infra/migrations', migrationFile);

  console.log(`[GAFER-MIGRATOR] Ejecutando migración ${direction.toUpperCase()}: ${resolvedPath}`);

  try {
    const sqlContent = await fs.readFile(resolvedPath, 'utf-8');

    // Ejecutar en bloque SQL
    await sql.raw(sqlContent).execute(db);

    console.log(`[GAFER-MIGRATOR] Migración ${direction.toUpperCase()} completada exitosamente.`);
  } catch (error) {
    console.error(`[GAFER-MIGRATOR] Error ejecutando migración ${direction.toUpperCase()}:`, error);
    throw error;
  } finally {
    await db.destroy();
    await pool.end();
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
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
