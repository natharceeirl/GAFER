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
import {
  cerrarFormulario,
  ConfigServicioBorrador,
  FormularioCampo,
} from './formulario-campo';

interface DatosBorradorJson {
  datosDrt?: ActaServicioDrt;
  datosCampo?: FormularioCampo;
  configServicio?: ConfigServicioBorrador;
}

function parsearDatosJson(raw: string | null): DatosBorradorJson {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    if ('datosDrt' in parsed || 'datosCampo' in parsed || 'configServicio' in parsed) {
      return {
        datosDrt: parsed.datosDrt as ActaServicioDrt | undefined,
        datosCampo: parsed.datosCampo as FormularioCampo | undefined,
        configServicio: parsed.configServicio as ConfigServicioBorrador | undefined,
      };
    }

    // Retrocompatibilidad con filas guardadas sin envoltorio compuesto.
    if (parsed.planillaEstaciones || parsed.actividad) {
      return { datosDrt: parsed as ActaServicioDrt };
    }
    if (parsed.insumos || parsed.metodos || parsed.clienteRazon) {
      return { datosCampo: parsed as FormularioCampo };
    }

    return {};
  } catch {
    return {};
  }
}

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
    const { datosDrt, datosCampo, configServicio } = parsearDatosJson(fila.datos_json);

    return {
      servicioId: fila.servicio_id,
      usuarioId: fila.usuario_id || undefined,
      clienteRazonSocial: fila.cliente_razon_social ?? undefined,
      sedeNombre: fila.sede_nombre ?? undefined,
      numeroOrden: fila.numero_orden ?? undefined,
      servicioTipo: fila.servicio_tipo ?? undefined,
      observaciones: fila.observaciones ?? '',
      configServicio,
      datosDrt,
      datosCampo,
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

      if (metadata?.configServicio !== undefined) {
        const previa = await tx.getFirstAsync<{ datos_json: string | null }>(
          `SELECT datos_json FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
          [servicioId, usuarioId],
        );
        const combinado = parsearDatosJson(previa?.datos_json ?? null);
        if (!combinado.configServicio) {
          combinado.configServicio = metadata.configServicio;
          await tx.runAsync(
            `UPDATE borradores_inspeccion SET datos_json = ? WHERE servicio_id = ? AND usuario_id = ?;`,
            [JSON.stringify(combinado), servicioId, usuarioId],
          );
        }
      }

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
   * Preserva `datosCampo` y `configServicio` coexistentes para el mismo `(servicio_id, usuario_id)`.
   */
  async guardarDrt(
    acta: ActaServicioDrt,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    return this.guardarFormulario({
      servicioId: acta.servicioId,
      usuarioId: metadata?.usuarioId,
      clienteRazonSocial: metadata?.clienteRazonSocial ?? acta.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre ?? acta.sedeDireccion,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? 'DESRATIZACION_DRT',
      observaciones: acta.resultadosRecomendaciones || '',
      datosDrt: acta,
      configServicio: metadata?.configServicio,
    });
  }

  /**
   * Guarda de forma durable el formulario de campo por bloques (§4, §8.2).
   * Preserva `datosDrt` y `configServicio` coexistentes para el mismo `(servicio_id, usuario_id)`.
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
      datosCampo: formulario,
      configServicio: metadata?.configServicio,
    });
  }

  /**
   * Upsert del formulario de un borrador (acta DRT y/o formulario de campo).
   * Fusiona `datos_json` dentro de la misma transacción exclusiva para que `datosDrt`,
   * `datosCampo` y `configServicio` coexistan sin sobrescribirse destructivamente.
   */
  private async guardarFormulario(datos: {
    servicioId: string;
    usuarioId?: string;
    clienteRazonSocial?: string;
    sedeNombre?: string;
    numeroOrden?: string;
    servicioTipo?: string;
    observaciones: string;
    datosDrt?: ActaServicioDrt;
    datosCampo?: FormularioCampo;
    configServicio?: ConfigServicioBorrador;
  }): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const propietario = datos.usuarioId ?? '';

    return db.withExclusiveTransactionAsync(async (tx) => {
      const previa = await tx.getFirstAsync<{ datos_json: string | null }>(
        `SELECT datos_json FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [datos.servicioId, propietario],
      );
      const combinado = parsearDatosJson(previa?.datos_json ?? null);
      if (datos.datosDrt !== undefined) {
        combinado.datosDrt = datos.datosDrt;
      }
      if (datos.datosCampo !== undefined) {
        combinado.datosCampo = datos.datosCampo;
      }
      if (datos.configServicio !== undefined) {
        combinado.configServicio = datos.configServicio;
      }
      const datosJsonCombinado = JSON.stringify(combinado);

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
          observaciones = CASE
            WHEN excluded.observaciones != '' THEN excluded.observaciones
            ELSE borradores_inspeccion.observaciones
          END,
          datos_json = excluded.datos_json,
          actualizado_en = excluded.actualizado_en,
          sync_status = 'PENDING_SYNC';`,
        [
          datos.servicioId,
          propietario,
          datos.clienteRazonSocial ?? null,
          datos.sedeNombre ?? null,
          datos.numeroOrden ?? null,
          datos.servicioTipo ?? null,
          datos.observaciones,
          datosJsonCombinado,
          ahora,
        ],
      );

      const fila = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [datos.servicioId, propietario],
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
      await tx.runAsync(
        `DELETE FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [operacion.agregadoId, operacion.actorId],
      );
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

    const operacion: OperacionSync = OperacionSyncSchema.parse({
      operationId,
      tipo: 'REGISTRO_SERVICIO_DRT',
      agregadoId: parsed.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: parsed as unknown as Record<string, unknown>,
    });

    // Si la app se cierra a mitad, o quedan ambos cambios o ninguno
    // (no hay envío duplicado ni borrador huérfano).
    await this.encolarYQuitarBorrador(operacion, { deviceId, aggregateType: 'SERVICIO_DRT' });

    return { operationId };
  }

  /**
   * Finaliza la inspección de campo por bloques (§4, §8.3): valida los bloques requeridos,
   * valida la operación contra `OperacionSyncSchema` antes de encolar, inserta en `sync_outbox`
   * y remueve el borrador local de forma atómica.
   */
  async finalizarYEncolarCampo(
    formulario: FormularioCampo,
    usuarioId: string,
    deviceId = 'device-mobile-local',
  ): Promise<{ operationId: string }> {
    const ahora = new Date().toISOString();
    const cerrado = cerrarFormulario(formulario, usuarioId, ahora);
    const operationId = generarUuid();

    const operacion: OperacionSync = OperacionSyncSchema.parse({
      operationId,
      tipo: 'REGISTRO_SERVICIO_CAMPO',
      agregadoId: cerrado.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: cerrado as unknown as Record<string, unknown>,
    });

    await this.encolarYQuitarBorrador(operacion, {
      deviceId,
      aggregateType: 'INSPECCION_CAMPO',
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
