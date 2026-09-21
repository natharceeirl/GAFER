/**
 * env.ts
 * Hace que la API use la base de pruebas y no la de desarrollo.
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 */
import { assertTestDatabase, TEST_DATABASE_URL } from './config';

// Se ejecuta ANTES de cargar la app: fuerza a que el API use la base de pruebas
// (dotenv no sobrescribe variables ya definidas, así que el .env de desarrollo no interfiere).
assertTestDatabase(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL;
