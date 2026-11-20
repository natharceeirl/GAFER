/**
 * GAFER Mobile — Módulo SQLite (Arquitectura Hexagonal)
 * Provee el singleton de base de datos e inicialización automática de migraciones.
 */

import { SqliteDatabasePort } from './database-port';
import { ejecutarMigraciones } from './migrations';
import { MemorySqliteAdapter } from './memory-sqlite-adapter';
import { ExpoSqliteAdapter } from './expo-sqlite-adapter';

export * from './database-port';
export * from './migrations';
export * from './memory-sqlite-adapter';
export * from './expo-sqlite-adapter';

let instanciaDb: SqliteDatabasePort | null = null;
let inicializandoPromesa: Promise<SqliteDatabasePort> | null = null;

export const NOMBRE_BASE_DATOS = 'gafer_mobile.db';

function esEntornoNativo(): boolean {
  // Si estamos en Node.js (Vitest / CLI), nunca es entorno nativo
  if (typeof process !== 'undefined' && process.versions?.node) {
    return false;
  }

  // En dispositivo móvil React Native (Android / iOS)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    return Platform?.OS === 'android' || Platform?.OS === 'ios';
  } catch {
    return false;
  }
}

async function abrirBaseDeDatosNativa(): Promise<SqliteDatabasePort> {
  const moduloExpo = 'expo-sqlite';
  const SQLite = await import(/* @vite-ignore */ moduloExpo);
  const nativeDb = await SQLite.openDatabaseAsync(NOMBRE_BASE_DATOS);
  return new ExpoSqliteAdapter(nativeDb);
}

/**
 * Inicializa la base de datos local según la plataforma, ejecuta migraciones y configura pragmas.
 * Si ya fue inicializada, devuelve la instancia existente.
 */
export async function inicializarBaseDeDatos(
  overridePort?: SqliteDatabasePort,
): Promise<SqliteDatabasePort> {
  if (instanciaDb) {
    return instanciaDb;
  }

  if (inicializandoPromesa) {
    return inicializandoPromesa;
  }

  inicializandoPromesa = (async () => {
    let dbPort: SqliteDatabasePort;

    if (overridePort) {
      dbPort = overridePort;
    } else if (esEntornoNativo()) {
      dbPort = await abrirBaseDeDatosNativa();
    } else {
      // Entorno de pruebas (Node/Vitest) o Web
      dbPort = new MemorySqliteAdapter();
    }

    await ejecutarMigraciones(dbPort);
    instanciaDb = dbPort;
    return dbPort;
  })();

  try {
    return await inicializandoPromesa;
  } finally {
    inicializandoPromesa = null;
  }
}

/**
 * Devuelve la instancia activa del puerto de base de datos.
 * Lanza un error si aún no ha sido inicializada con inicializarBaseDeDatos().
 */
export function obtenerBaseDeDatos(): SqliteDatabasePort {
  if (!instanciaDb) {
    throw new Error(
      'La base de datos SQLite no ha sido inicializada. Llama primero a inicializarBaseDeDatos().',
    );
  }
  return instanciaDb;
}

/**
 * Cierra la conexión de base de datos y libera el singleton.
 */
export async function cerrarBaseDeDatos(): Promise<void> {
  if (instanciaDb) {
    await instanciaDb.closeAsync();
    instanciaDb = null;
  }
}
