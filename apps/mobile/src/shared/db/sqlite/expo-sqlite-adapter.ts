/**
 * GAFER Mobile — ExpoSqliteAdapter
 * Adaptador de producción para dispositivos Android/iOS utilizando expo-sqlite.
 * Cumple con la Guía de Arquitectura Offline-First Rev 2 (§5.5).
 */

import { QueryResult, SqliteDatabasePort } from './database-port';

export interface ExpoSQLiteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
  withExclusiveTransactionAsync(task: (txn: any) => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

export class ExpoSqliteAdapter implements SqliteDatabasePort {
  constructor(private readonly db: ExpoSQLiteDatabaseLike) {}

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const res = await this.db.runAsync(sql, ...(params as any[]));
    return {
      changes: res.changes,
      lastInsertRowId: res.lastInsertRowId,
    };
  }

  async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await this.db.getAllAsync<T>(sql, ...(params as any[]));
  }

  async getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return await this.db.getFirstAsync<T>(sql, ...(params as any[]));
  }

  async withExclusiveTransactionAsync<T>(
    action: (db: SqliteDatabasePort) => Promise<T>,
  ): Promise<T> {
    let result: T;
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      const adapter = new ExpoSqliteAdapter(txn);
      result = await action(adapter);
    });
    return result!;
  }

  async closeAsync(): Promise<void> {
    await this.db.closeAsync();
  }
}
