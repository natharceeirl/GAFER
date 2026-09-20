/**
 * Configuración compartida de la suite E2E.
 * La base de pruebas se puede cambiar con la variable TEST_DATABASE_URL (útil en CI).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://gafer:gafer@localhost:5432/gafer_test';

/**
 * Seguro anti-desastres: las pruebas hacen TRUNCATE de todas las tablas, así que
 * SOLO pueden correr contra una base cuyo nombre termine en `_test`.
 */
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
