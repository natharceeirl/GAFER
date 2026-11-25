/**
 * GAFER Mobile — ExpoSqliteAdapter
 * Adaptador de producción para dispositivos Android/iOS utilizando expo-sqlite.
 * Cumple con la Guía de Arquitectura Offline-First Rev 2 (§5.5).
 *
 * Todas las operaciones usan UNA sola conexión, serializadas con ColaSerial.
 * No se usa `withExclusiveTransactionAsync` de expo-sqlite porque abre una conexión
 * nueva por transacción, sin los PRAGMA de `configurarPragmas` (busy_timeout,
 * synchronous, foreign_keys): dos escrituras simultáneas fallaban con
 * "database is locked" y las claves foráneas no se validaban dentro de la transacción.
 */

import { ColaSerial } from './cola-serial';
import { QueryResult, SqliteDatabasePort } from './database-port';

export interface ExpoSQLiteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
  closeAsync(): Promise<void>;
}

/**
 * Vista de la conexión que se entrega dentro de una transacción en curso.
 * Ejecuta directo sobre la conexión (la cola ya está tomada por la transacción).
 */
class ConexionEnTransaccion implements SqliteDatabasePort {
  constructor(private readonly db: ExpoSQLiteDatabaseLike) {}

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const res = await this.db.runAsync(sql, ...(params as any[]));
    return { changes: res.changes, lastInsertRowId: res.lastInsertRowId };
  }

  async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, ...(params as any[]));
  }

  async getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, ...(params as any[]));
  }

  /** Una transacción anidada se une a la transacción en curso. */
  async withExclusiveTransactionAsync<T>(
    action: (db: SqliteDatabasePort) => Promise<T>,
  ): Promise<T> {
    return action(this);
  }

  async closeAsync(): Promise<void> {
    throw new Error('No se puede cerrar la base de datos dentro de una transacción');
  }
}

export class ExpoSqliteAdapter implements SqliteDatabasePort {
  private readonly cola = new ColaSerial();
  private readonly directa: ConexionEnTransaccion;

  constructor(private readonly db: ExpoSQLiteDatabaseLike) {
    this.directa = new ConexionEnTransaccion(db);
  }

  execAsync(sql: string): Promise<void> {
    return this.cola.ejecutar(() => this.directa.execAsync(sql));
  }

  runAsync(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return this.cola.ejecutar(() => this.directa.runAsync(sql, params));
  }

  getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.cola.ejecutar(() => this.directa.getAllAsync<T>(sql, params));
  }

  getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return this.cola.ejecutar(() => this.directa.getFirstAsync<T>(sql, params));
  }

  /**
   * Transacción de escritura (BEGIN IMMEDIATE) sobre la conexión principal.
   * Ninguna otra operación de este adaptador corre hasta el COMMIT o ROLLBACK.
   */
  withExclusiveTransactionAsync<T>(
    action: (db: SqliteDatabasePort) => Promise<T>,
  ): Promise<T> {
    return this.cola.ejecutar(async () => {
      await this.db.execAsync('BEGIN IMMEDIATE;');
      try {
        const resultado = await action(this.directa);
        await this.db.execAsync('COMMIT;');
        return resultado;
      } catch (error) {
        try {
          await this.db.execAsync('ROLLBACK;');
        } catch {
          // SQLite ya pudo haber revertido la transacción por su cuenta
        }
        throw error;
      }
    });
  }

  closeAsync(): Promise<void> {
    return this.cola.ejecutar(() => this.db.closeAsync());
  }
}
