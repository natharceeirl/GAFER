/**
 * GAFER Mobile — BorradorRepository
 * Repositorio SQLite para persistencia durable de borradores de inspección en campo.
 * Cumple con la regla 2.4: "Durable before visible" (Guía Rev 2 §2.4, §5.1).
 */

import { ActaServicioDrt, ActaServicioDrtSchema, OperacionSync } from '@gafer/contracts';
import { SqliteDatabasePort, obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { generarUuid } from '../../../shared/utils/uuid';
import { BorradorInspeccion, MetadataBorrador } from './use-borrador-store';
import {
  cerrarFormulario,
  FormularioCampo,
  validarCierre,
} from './formulario-campo';

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
    let datosCampo: FormularioCampo | undefined;

    if (fila.datos_json) {
      try {
        const parsed = JSON.parse(fila.datos_json);
        if (parsed.planillaEstaciones || parsed.actividad) {
          datosDrt = parsed;
        } else if (parsed.insumos || parsed.metodos || parsed.clienteRazon) {
          datosCampo = parsed;
        }
      } catch {
        datosDrt = undefined;
        datosCampo = undefined;
      }
    }

    return {
      servicioId: fila.servicio_id,
      usuarioId: fila.usuario_id ?? undefined,
      clienteRazonSocial: fila.cliente_razon_social ?? undefined,
      sedeNombre: fila.sede_nombre ?? undefined,
      numeroOrden: fila.numero_orden ?? undefined,
      servicioTipo: fila.servicio_tipo ?? undefined,
      observaciones: fila.observaciones ?? '',
      datosDrt,
      datosCampo,
    };
  }

  /**
   * Abre el borrador de un servicio de forma idempotente y devuelve lo que quedó en disco.
   *
   * - Si no existe, lo crea con `observacionesIniciales`.
   * - Si ya existe (la visita se reabre), solo refresca la cabecera (cliente, sede, orden,
   *   tipo y usuario). Las observaciones y los datos del formulario NO se tocan: así
   *   reabrir una visita nunca borra las notas que el técnico ya escribió.
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
        ON CONFLICT(servicio_id) DO UPDATE SET
          usuario_id = COALESCE(excluded.usuario_id, borradores_inspeccion.usuario_id),
          cliente_razon_social = COALESCE(excluded.cliente_razon_social, borradores_inspeccion.cliente_razon_social),
          sede_nombre = COALESCE(excluded.sede_nombre, borradores_inspeccion.sede_nombre),
          numero_orden = COALESCE(excluded.numero_orden, borradores_inspeccion.numero_orden),
          servicio_tipo = COALESCE(excluded.servicio_tipo, borradores_inspeccion.servicio_tipo),
          actualizado_en = excluded.actualizado_en;`,
        [
          servicioId,
          metadata?.usuarioId ?? null,
          metadata?.clienteRazonSocial ?? null,
          metadata?.sedeNombre ?? null,
          metadata?.numeroOrden ?? null,
          metadata?.servicioTipo ?? null,
          observacionesIniciales,
          ahora,
        ],
      );

      const fila = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ?;`,
        [servicioId],
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
    // El acta es la fuente de las observaciones del DRT.
    return this.guardarFormulario({
      servicioId: acta.servicioId,
      usuarioId: metadata?.usuarioId,
      clienteRazonSocial: metadata?.clienteRazonSocial ?? acta.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre ?? acta.sedeDireccion,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? 'DESRATIZACION_DRT',
      observaciones: acta.resultadosRecomendaciones || '',
      datosJson: JSON.stringify(acta),
    });
  }

  /**
   * Guarda de forma durable el formulario de campo por bloques (§4, §8.2).
   */
  async guardarCampo(
    formulario: FormularioCampo,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    const observaciones =
      formulario.observacionesLibre ||
      (formulario.observaciones.length > 0 ? formulario.observaciones.join('. ') : '');

    return this.guardarFormulario({
      servicioId: formulario.servicioId,
      usuarioId: metadata?.usuarioId,
      clienteRazonSocial: metadata?.clienteRazonSocial ?? formulario.clienteRazon,
      sedeNombre: metadata?.sedeNombre ?? formulario.proyectoNombre,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? formulario.servicioEtiqueta,
      observaciones,
      datosJson: JSON.stringify(formulario),
    });
  }

  /**
   * Upsert del formulario de un borrador (acta DRT o formulario de campo).
   * No usa INSERT OR REPLACE: conserva usuario_id, server_version y la cabecera que no
   * venga en los datos. Devuelve lo que quedó en disco.
   */
  private async guardarFormulario(datos: {
    servicioId: string;
    usuarioId?: string;
    clienteRazonSocial?: string;
    sedeNombre?: string;
    numeroOrden?: string;
    servicioTipo?: string;
    observaciones: string;
    datosJson: string;
  }): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();

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
        ON CONFLICT(servicio_id) DO UPDATE SET
          usuario_id = COALESCE(excluded.usuario_id, borradores_inspeccion.usuario_id),
          cliente_razon_social = COALESCE(excluded.cliente_razon_social, borradores_inspeccion.cliente_razon_social),
          sede_nombre = COALESCE(excluded.sede_nombre, borradores_inspeccion.sede_nombre),
          numero_orden = COALESCE(excluded.numero_orden, borradores_inspeccion.numero_orden),
          servicio_tipo = COALESCE(borradores_inspeccion.servicio_tipo, excluded.servicio_tipo),
          observaciones = excluded.observaciones,
          datos_json = excluded.datos_json,
          actualizado_en = excluded.actualizado_en,
          sync_status = 'PENDING_SYNC';`,
        [
          datos.servicioId,
          datos.usuarioId ?? null,
          datos.clienteRazonSocial ?? null,
          datos.sedeNombre ?? null,
          datos.numeroOrden ?? null,
          datos.servicioTipo ?? null,
          datos.observaciones,
          datos.datosJson,
          ahora,
        ],
      );

      const fila = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ?;`,
        [datos.servicioId],
      );
      if (!fila) {
        throw new Error(`No se pudo guardar el borrador del servicio ${datos.servicioId}`);
      }
      return this.mapearFilaABorrador(fila);
    });
  }

  /** Encola la operación y quita el borrador en UNA transacción (todo o nada). */
  private async encolarYQuitarBorrador(
    operacion: OperacionSync,
    opciones: { deviceId: string; aggregateType: string },
  ): Promise<void> {
    await this.getDb().withExclusiveTransactionAsync(async (tx) => {
      await new OutboxQueue(tx).encolar(operacion, { ...opciones, priority: 'HIGH' });
      await tx.runAsync(`DELETE FROM borradores_inspeccion WHERE servicio_id = ?;`, [
        operacion.agregadoId,
      ]);
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

    const operacion: OperacionSync = {
      operationId,
      tipo: 'REGISTRO_SERVICIO_DRT',
      agregadoId: parsed.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: parsed as unknown as Record<string, unknown>,
    };

    // Si la app se cierra a mitad, o quedan ambos cambios o ninguno
    // (no hay envío duplicado ni borrador huérfano).
    await this.encolarYQuitarBorrador(operacion, { deviceId, aggregateType: 'SERVICIO_DRT' });

    return { operationId };
  }

  /**
   * Finaliza la inspección de campo por bloques (§4, §8.3): valida los bloques requeridos,
   * encola el formulario cerrado en la tabla sync_outbox de SQLite y remueve el borrador local.
   */
  async finalizarYEncolarCampo(
    formulario: FormularioCampo,
    usuarioId: string,
    deviceId = 'device-mobile-local',
  ): Promise<{ operationId: string }> {
    const ahora = new Date().toISOString();
    const cerrado = cerrarFormulario(formulario, usuarioId, ahora);
    const operationId = generarUuid();

    const operacion: OperacionSync = {
      operationId,
      tipo: 'REGISTRO_SERVICIO_CAMPO',
      agregadoId: cerrado.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: cerrado as unknown as Record<string, unknown>,
    };

    await this.encolarYQuitarBorrador(operacion, {
      deviceId,
      aggregateType: 'INSPECCION_CAMPO',
    });

    return { operationId };
  }

  /**
   * Actualiza las observaciones del borrador de manera atómica y durable.
   */
  async actualizarObservaciones(servicioId: string, observaciones: string): Promise<void> {
    const db = this.getDb();
    const ahora = new Date().toISOString();

    const resultado = await db.withExclusiveTransactionAsync((tx) =>
      tx.runAsync(
        `UPDATE borradores_inspeccion
         SET observaciones = ?, actualizado_en = ?
         WHERE servicio_id = ?;`,
        [observaciones, ahora, servicioId],
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
