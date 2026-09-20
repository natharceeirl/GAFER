/**
 * config.ts
 * Dirección de la base de pruebas y control que impide usar otra base.
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://gafer:gafer@localhost:5432/gafer_test';

/** Las pruebas borran todos los datos, por eso solo se permite una base cuyo nombre termine en _test. */
export function assertTestDatabase(url: string): string {
  const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `[QA] Por seguridad las pruebas E2E solo corren contra una base cuyo nombre termina en "_test" ` +
        `(recibido: "${dbName}"). Revisa TEST_DATABASE_URL.`,
    );
  }
  return dbName;
}
