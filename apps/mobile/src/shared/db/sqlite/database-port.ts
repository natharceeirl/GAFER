/**
 * GAFER Mobile — SqliteDatabasePort
 * Contrato formal para el acceso a SQLite local siguiendo la Arquitectura Hexagonal.
 * Desacopla la lógica de negocio y las stores del motor nativo de C++ (expo-sqlite),
 * permitiendo pruebas veloces en Vitest/Node.js con MemorySqliteAdapter.
 */

export interface QueryResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqliteDatabasePort {
  /**
   * Ejecuta sentencias DDL/DML por bloques (ej. scripts de migración).
   */
  execAsync(sql: string): Promise<void>;

  /**
   * Ejecuta una consulta de mutación parametrizada (INSERT, UPDATE, DELETE).
   */
  runAsync(sql: string, params?: unknown[]): Promise<QueryResult>;

  /**
   * Ejecuta una consulta de lectura que devuelve múltiples filas tipadas.
   */
  getAllAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Ejecuta una consulta de lectura que devuelve la primera fila o null.
   */
  getFirstAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;

  /**
   * Ejecuta un bloque de operaciones dentro de una transacción exclusiva (WAL mode).
   * Si la promesa interna falla o lanza excepción, hace ROLLBACK automático.
   */
  withExclusiveTransactionAsync<T>(
    action: (db: SqliteDatabasePort) => Promise<T>,
  ): Promise<T>;

  /**
   * Cierra la conexión a la base de datos de forma limpia.
   */
  closeAsync(): Promise<void>;
}
