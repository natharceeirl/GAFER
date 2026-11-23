/**
 * GAFER Mobile — BorradorRepository
 * Repositorio SQLite para persistencia durable de borradores de inspección en campo.
 * Cumple con la regla 2.4: "Durable before visible" (Guía Rev 2 §2.4, §5.1).
 */

import {
  ActaServicioDrt,
  ActaServicioDrtSchema,
  OperacionSync,
  OperacionSyncSchema,
} from '@gafer/contracts';
import { SqliteDatabasePort, obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { generarUuid } from '../../../shared/utils/uuid';
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
    let datosDrt: ActaServicioDrt | undefined;
    if (fila.datos_json) {
      try {
        datosDrt = JSON.parse(fila.datos_json);
      } catch {
        datosDrt = undefined;
      }
    }

    return {
      servicioId: fila.servicio_id,
      usuarioId: fila.usuario_id || undefined,
      clienteRazonSocial: fila.cliente_razon_social ?? undefined,
      sedeNombre: fila.sede_nombre ?? undefined,
      numeroOrden: fila.numero_orden ?? undefined,
      servicioTipo: fila.servicio_tipo ?? undefined,
      observaciones: fila.observaciones ?? '',
      datosDrt,
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
   * Guarda de forma durable el formulario completo del Acta de Servicio DRT (§2.4).
   */
  async guardarDrt(
    acta: ActaServicioDrt,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const datosJson = JSON.stringify(acta);
    const propietario = metadata?.usuarioId ?? '';

    // Upsert (no INSERT OR REPLACE): conserva usuario_id, server_version y la cabecera
    // que la metadata no traiga. El acta es la fuente de las observaciones del DRT.
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
          datos_json,
          actualizado_en,
          server_version,
          sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_SYNC')
        ON CONFLICT(servicio_id, usuario_id) DO UPDATE SET
          cliente_razon_social = COALESCE(excluded.cliente_razon_social, borradores_inspeccion.cliente_razon_social),
          sede_nombre = COALESCE(excluded.sede_nombre, borradores_inspeccion.sede_nombre),
          numero_orden = COALESCE(excluded.numero_orden, borradores_inspeccion.numero_orden),
          servicio_tipo = COALESCE(borradores_inspeccion.servicio_tipo, excluded.servicio_tipo),
          observaciones = excluded.observaciones,
          datos_json = excluded.datos_json,
          actualizado_en = excluded.actualizado_en,
          sync_status = 'PENDING_SYNC';`,
        [
          acta.servicioId,
          propietario,
          metadata?.clienteRazonSocial ?? acta.clienteRazonSocial ?? null,
          metadata?.sedeNombre ?? acta.sedeDireccion ?? null,
          metadata?.numeroOrden ?? null,
          metadata?.servicioTipo ?? 'DESRATIZACION_DRT',
          acta.resultadosRecomendaciones || '',
          datosJson,
          ahora,
        ],
      );

      const fila = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [acta.servicioId, propietario],
      );
      if (!fila) {
        throw new Error(`No se pudo guardar el acta DRT del servicio ${acta.servicioId}`);
      }
      return this.mapearFilaABorrador(fila);
    });
  }

  /**
   * Finaliza el servicio DRT: valida el acta, la encola en la tabla sync_outbox
   * y remueve el borrador activo localmente para dejar el terminal listo para el siguiente servicio.
   */
  async finalizarYEncolarDrt(
    acta: ActaServicioDrt,
    usuarioId: string,
    deviceId = 'device-mobile-local',
  ): Promise<{ operationId: string }> {
    const parsed = ActaServicioDrtSchema.parse(acta);
    const operationId = generarUuid();
    const ahora = new Date().toISOString();
    const db = this.getDb();

    const operacion: OperacionSync = OperacionSyncSchema.parse({
      operationId,
      tipo: 'REGISTRO_SERVICIO_DRT',
      agregadoId: parsed.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: parsed as unknown as Record<string, unknown>,
    });

    // Encolar y quitar el borrador en UNA transacción: si la app se cierra a mitad,
    // o quedan ambos cambios o ninguno (no hay envío duplicado ni borrador huérfano).
    await db.withExclusiveTransactionAsync(async (tx) => {
      await new OutboxQueue(tx).encolar(operacion, {
        deviceId,
        aggregateType: 'SERVICIO_DRT',
        priority: 'HIGH',
      });
      await tx.runAsync(
        `DELETE FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [parsed.servicioId, usuarioId],
      );
    });

    return { operationId };
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
