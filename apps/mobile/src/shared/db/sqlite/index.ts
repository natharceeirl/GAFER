/**
 * GAFER Mobile — Módulo SQLite (Arquitectura Hexagonal)
 * Provee el singleton de base de datos e inicialización automática de migraciones.
 */

import { SqliteDatabasePort } from './database-port';
import { ejecutarMigraciones } from './migrations';
import { MemorySqliteAdapter } from './memory-sqlite-adapter';
import { ExpoSqliteAdapter, ExpoSQLiteDatabaseLike } from './expo-sqlite-adapter';

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
  // Referencia estática con literal obligatoria para que Metro incluya expo-sqlite en el bundle nativo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SQLite = require('expo-sqlite') as {
    openDatabaseAsync: (databaseName: string) => Promise<ExpoSQLiteDatabaseLike>;
  };
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

    try {
      await ejecutarMigraciones(dbPort);
    } catch (error) {
      try {
        await dbPort.closeAsync();
      } catch {
        // No ocultar el error original de migración si el cierre también falla.
      }
      throw error;
    }

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
