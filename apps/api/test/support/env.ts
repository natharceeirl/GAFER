import { assertTestDatabase, TEST_DATABASE_URL } from './config';

// Se ejecuta ANTES de cargar la app: fuerza a que el API use la base de pruebas
// (dotenv no sobrescribe variables ya definidas, así que el .env de desarrollo no interfiere).
assertTestDatabase(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL;
