/**
 * storage-adapter.ts
 * Abstracción de almacenamiento clave-valor persistente para la app móvil.
 * Permite desacoplar el motor nativo (AsyncStorage / SecureStore) de los stores y pruebas.
 */

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Adaptador en memoria para entornos de pruebas automatizadas y ejecución sin almacenamiento nativo.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/** Instancia por defecto utilizada por la aplicación */
let defaultStorageInstance: StorageAdapter = new MemoryStorageAdapter();

export function getDefaultStorage(): StorageAdapter {
  return defaultStorageInstance;
}

export function setDefaultStorage(adapter: StorageAdapter): void {
  defaultStorageInstance = adapter;
}
