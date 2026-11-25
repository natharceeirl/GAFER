/**
 * GAFER Mobile — BorradorRepository
 * Repositorio SQLite para persistencia durable de borradores de inspección en campo.
 * Cumple con la regla 2.4: "Durable before visible" (Guía Rev 2 §2.4, §5.1).
 */

import { SqliteDatabasePort, obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { BorradorInspeccion, MetadataBorrador } from './use-borrador-store';

interface FilaBorradorDb {
  servicio_id: string;
  usuario_id: string | null;
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
      usuarioId: fila.usuario_id || undefined,
      clienteRazonSocial: fila.cliente_razon_social ?? undefined,
      sedeNombre: fila.sede_nombre ?? undefined,
      numeroOrden: fila.numero_orden ?? undefined,
      servicioTipo: fila.servicio_tipo ?? undefined,
      observaciones: fila.observaciones ?? '',
    };
  }

  /**
   * Abre el borrador de un servicio para un técnico de forma idempotente y devuelve lo que quedó en disco.
   *
   * La clave primaria compuesta `(servicio_id, usuario_id)` aísla por completo a cada técnico
   * en un celular compartido: abrir la misma visita o sede de contingencia nunca roba ni expone
   * observaciones ni `datos_json` de otro técnico.
   *
   * - Si no existe para `(servicioId, usuarioId)`, lo crea con `observacionesIniciales`.
   * - Si ya existe para el mismo técnico, solo refresca la cabecera (cliente, sede, orden y tipo).
   *   Las observaciones y los datos del formulario NO se tocan.
   *
   * La metadata vacía no pisa la cabecera guardada (COALESCE).
   */
  async guardar(
    servicioId: string,
    metadata?: MetadataBorrador,
    observacionesIniciales = '',
  ): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const usuarioId = metadata?.usuarioId ?? '';

    return db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO borradores_inspeccion (
          servicio_id,
          usuario_id,
          cliente_razon_social,
          sede_nombre,
          numero_orden,
          servicio_tipo,
          observaciones,
          actualizado_en,
          server_version,
          sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_SYNC')
        ON CONFLICT(servicio_id, usuario_id) DO UPDATE SET
          cliente_razon_social = COALESCE(excluded.cliente_razon_social, borradores_inspeccion.cliente_razon_social),
          sede_nombre = COALESCE(excluded.sede_nombre, borradores_inspeccion.sede_nombre),
          numero_orden = COALESCE(excluded.numero_orden, borradores_inspeccion.numero_orden),
          servicio_tipo = COALESCE(excluded.servicio_tipo, borradores_inspeccion.servicio_tipo),
          actualizado_en = excluded.actualizado_en;`,
        [
          servicioId,
          usuarioId,
          metadata?.clienteRazonSocial ?? null,
          metadata?.sedeNombre ?? null,
          metadata?.numeroOrden ?? null,
          metadata?.servicioTipo ?? null,
          observacionesIniciales,
          ahora,
        ],
      );

      const fila = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [servicioId, usuarioId],
      );
      if (!fila) {
        throw new Error(`No se pudo guardar el borrador del servicio ${servicioId}`);
      }
      return this.mapearFilaABorrador(fila);
    });
  }

  /**
   * Actualiza las observaciones del borrador de manera atómica y durable para el técnico dueño.
   */
  async actualizarObservaciones(
    servicioId: string,
    observaciones: string,
    usuarioId?: string,
  ): Promise<void> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const propietario = usuarioId ?? '';

    const resultado = await db.withExclusiveTransactionAsync((tx) =>
      tx.runAsync(
        `UPDATE borradores_inspeccion
         SET observaciones = ?, actualizado_en = ?
         WHERE servicio_id = ? AND usuario_id = ?;`,
        [observaciones, ahora, servicioId, propietario],
      ),
    );

    // Un UPDATE que no afecta filas significa que las notas NO quedaron en disco.
    if (resultado.changes === 0) {
      throw new Error(
        `No existe un borrador para el servicio ${servicioId}; las observaciones no se guardaron`,
      );
    }
  }

  /**
   * Obtiene el borrador por ID de servicio y técnico dueño.
   */
  async obtenerPorServicioId(
    servicioId: string,
    usuarioId?: string,
  ): Promise<BorradorInspeccion | null> {
    const db = this.getDb();
    const propietario = usuarioId ?? '';
    const fila = await db.getFirstAsync<FilaBorradorDb>(
      `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
      [servicioId, propietario],
    );

    return fila ? this.mapearFilaABorrador(fila) : null;
  }

  /**
   * Recupera el borrador más reciente DEL USUARIO indicado (para reanudar trabajo tras
   * reiniciar la app). Nunca devuelve borradores de otro técnico: en un celular compartido,
   * el técnico B no debe ver el cliente, la sede ni las notas del técnico A.
   */
  async obtenerActivo(usuarioId: string): Promise<BorradorInspeccion | null> {
    if (!usuarioId) {
      return null;
    }

    const db = this.getDb();
    const fila = await db.getFirstAsync<FilaBorradorDb>(
      `SELECT * FROM borradores_inspeccion
       WHERE usuario_id = ?
       ORDER BY actualizado_en DESC
       LIMIT 1;`,
      [usuarioId],
    );

    return fila ? this.mapearFilaABorrador(fila) : null;
  }

  /**
   * Elimina el borrador del técnico indicado (al concluir o descartar la inspección).
   */
  async eliminar(servicioId: string, usuarioId?: string): Promise<void> {
    const db = this.getDb();
    const propietario = usuarioId ?? '';
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `DELETE FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [servicioId, propietario],
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
