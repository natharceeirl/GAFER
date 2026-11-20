/**
 * GAFER Mobile — MemorySqliteAdapter
 * Adaptador en memoria que implementa SqliteDatabasePort.
 * En entorno Node.js (Vitest) aprovecha el motor SQLite nativo de Node (node:sqlite)
 * para ejecutar migraciones reales, transacciones exclusivas y consultas SQL idénticas
 * a las de Android/iOS sin depender de TurboModules de Expo ni mocks frágiles.
 * En navegadores web incluye fallback de memoria para evitar excepciones.
 *
 * Igual que ExpoSqliteAdapter, serializa las operaciones con ColaSerial para que dos
 * transacciones lanzadas a la vez no se intercalen (mismo comportamiento que en el dispositivo).
 */

import { ColaSerial } from './cola-serial';
import { QueryResult, SqliteDatabasePort } from './database-port';

function getDatabaseSync(): any {
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      let req: ((id: string) => any) | null = null;
      if (typeof require === 'function') {
        req = require;
      } else if (typeof (globalThis as any).require === 'function') {
        req = (globalThis as any).require;
      } else {
        // En Vitest ESM
        const { createRequire } = eval('require')('node:module');
        req = createRequire(process.cwd() + '/package.json');
      }

      if (req) {
        const mod = req('node:sqlite');
        return mod?.DatabaseSync ? new mod.DatabaseSync(':memory:') : null;
      }
    }
  } catch {
    // No disponible (ej. navegador o entorno sin node:sqlite)
  }
  return null;
}

/** Acceso directo al motor, sin cola. Se entrega dentro de las transacciones. */
class MotorMemoria implements SqliteDatabasePort {
  nativeDb: any;
  userVersion = 0;

  constructor() {
    this.nativeDb = getDatabaseSync();
  }

  async execAsync(sql: string): Promise<void> {
    const match = sql.match(/PRAGMA\s+user_version\s*=\s*(\d+)/i);
    if (match) {
      this.userVersion = parseInt(match[1], 10);
    }
    if (this.nativeDb) {
      this.nativeDb.exec(sql);
    }
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (this.nativeDb) {
      const stmt = this.nativeDb.prepare(sql);
      const res = stmt.run(...params);
      return {
        changes: Number(res.changes ?? 0),
        lastInsertRowId: Number(res.lastInsertRowid ?? 0),
      };
    }

    return { changes: 1, lastInsertRowId: 1 };
  }

  async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this.nativeDb) {
      const stmt = this.nativeDb.prepare(sql);
      return stmt.all(...params) as T[];
    }

    return [];
  }

  async getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.trim().toUpperCase().startsWith('PRAGMA USER_VERSION')) {
      if (this.nativeDb) {
        const row = this.nativeDb.prepare('PRAGMA user_version;').get() as any;
        return (row ?? { user_version: this.userVersion }) as T;
      }
      return { user_version: this.userVersion } as T;
    }

    if (this.nativeDb) {
      const row = this.nativeDb.prepare(sql).get(...params);
      return (row ?? null) as T | null;
    }

    return null;
  }

  /** Una transacción anidada se une a la transacción en curso. */
  async withExclusiveTransactionAsync<T>(
    action: (db: SqliteDatabasePort) => Promise<T>,
  ): Promise<T> {
    return action(this);
  }

  async closeAsync(): Promise<void> {
    if (this.nativeDb) {
      this.nativeDb.close();
      this.nativeDb = null;
    }
  }
}

export class MemorySqliteAdapter implements SqliteDatabasePort {
  private readonly cola = new ColaSerial();
  private readonly motor = new MotorMemoria();

  execAsync(sql: string): Promise<void> {
    return this.cola.ejecutar(() => this.motor.execAsync(sql));
  }

  runAsync(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return this.cola.ejecutar(() => this.motor.runAsync(sql, params));
  }

  getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.cola.ejecutar(() => this.motor.getAllAsync<T>(sql, params));
  }

  getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return this.cola.ejecutar(() => this.motor.getFirstAsync<T>(sql, params));
  }

  withExclusiveTransactionAsync<T>(
    action: (db: SqliteDatabasePort) => Promise<T>,
  ): Promise<T> {
    return this.cola.ejecutar(async () => {
      const nativeDb = this.motor.nativeDb;
      if (!nativeDb) {
        return action(this.motor);
      }

      nativeDb.exec('BEGIN IMMEDIATE TRANSACTION;');
      try {
        const result = await action(this.motor);
        nativeDb.exec('COMMIT;');
        return result;
      } catch (error) {
        try {
          nativeDb.exec('ROLLBACK;');
        } catch {
          // Ignorar si ya se hizo rollback
        }
        throw error;
      }
    });
  }

  closeAsync(): Promise<void> {
    return this.cola.ejecutar(() => this.motor.closeAsync());
  }
}
