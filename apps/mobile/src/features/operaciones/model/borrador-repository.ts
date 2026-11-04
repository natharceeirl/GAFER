/**
 * GAFER Mobile — BorradorRepository
 * Repositorio SQLite para persistencia durable de borradores de inspección en campo.
 * Cumple con la regla 2.4: "Durable before visible" (Guía Rev 2 §2.4, §5.1).
 */

import { SqliteDatabasePort, obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { BorradorInspeccion, MetadataBorrador } from './use-borrador-store';

interface FilaBorradorDb {
  servicio_id: string;
  cliente_razon_social: string | null;
  sede_nombre: string | null;
  numero_orden: string | null;
  servicio_tipo: string | null;
  observaciones: string;
  datos_json: string | null;
  actualizado_en: string;
  server_version: number;
  sync_status: string;
}

export class BorradorRepository {
  constructor(private readonly db?: SqliteDatabasePort) {}

  private getDb(): SqliteDatabasePort {
    return this.db ?? obtenerBaseDeDatos();
  }

  private mapearFilaABorrador(fila: FilaBorradorDb): BorradorInspeccion {
    return {
      servicioId: fila.servicio_id,
      clienteRazonSocial: fila.cliente_razon_social ?? undefined,
      sedeNombre: fila.sede_nombre ?? undefined,
      numeroOrden: fila.numero_orden ?? undefined,
      servicioTipo: fila.servicio_tipo ?? undefined,
      observaciones: fila.observaciones ?? '',
    };
  }

  /**
   * Guarda o actualiza un borrador en la base SQLite local en una transacción exclusiva.
   */
  async guardar(
    servicioId: string,
    metadata?: MetadataBorrador,
    observaciones = '',
  ): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT OR REPLACE INTO borradores_inspeccion (
          servicio_id,
          cliente_razon_social,
          sede_nombre,
          numero_orden,
          servicio_tipo,
          observaciones,
          actualizado_en,
          server_version,
          sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_SYNC');`,
        [
          servicioId,
          metadata?.clienteRazonSocial ?? null,
          metadata?.sedeNombre ?? null,
          metadata?.numeroOrden ?? null,
          metadata?.servicioTipo ?? null,
          observaciones,
          ahora,
        ],
      );
    });

    return {
      servicioId,
      observaciones,
      clienteRazonSocial: metadata?.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo,
    };
  }

  /**
   * Actualiza las observaciones del borrador de manera atómica y durable.
   */
  async actualizarObservaciones(servicioId: string, observaciones: string): Promise<void> {
    const db = this.getDb();
    const ahora = new Date().toISOString();

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `UPDATE borradores_inspeccion 
         SET observaciones = ?, actualizado_en = ? 
         WHERE servicio_id = ?;`,
        [observaciones, ahora, servicioId],
      );
    });
  }

  /**
   * Obtiene el borrador por ID de servicio.
   */
  async obtenerPorServicioId(servicioId: string): Promise<BorradorInspeccion | null> {
    const db = this.getDb();
    const fila = await db.getFirstAsync<FilaBorradorDb>(
      `SELECT * FROM borradores_inspeccion WHERE servicio_id = ?;`,
      [servicioId],
    );

    return fila ? this.mapearFilaABorrador(fila) : null;
  }

  /**
   * Recupera el borrador activo más reciente (para reanudar trabajo tras reinicio de app).
   */
  async obtenerActivo(): Promise<BorradorInspeccion | null> {
    const db = this.getDb();
    const fila = await db.getFirstAsync<FilaBorradorDb>(
      `SELECT * FROM borradores_inspeccion 
       ORDER BY actualizado_en DESC 
       LIMIT 1;`,
    );

    return fila ? this.mapearFilaABorrador(fila) : null;
  }

  /**
   * Elimina un borrador (al concluir o descartar la inspección).
   */
  async eliminar(servicioId: string): Promise<void> {
    const db = this.getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `DELETE FROM borradores_inspeccion WHERE servicio_id = ?;`,
        [servicioId],
      );
    });
  }

  /**
   * Limpia todos los borradores almacenados.
   */
  async limpiarTodos(): Promise<void> {
    const db = this.getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(`DELETE FROM borradores_inspeccion;`);
    });
  }
}
