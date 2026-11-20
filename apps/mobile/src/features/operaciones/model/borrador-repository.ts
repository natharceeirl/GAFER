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
import { fusionarActasColaborativas } from './trabajo-colaborativo';
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
    let guardadoPorInfo: { tecnicoId?: string; nombre?: string; cargo?: string } | undefined;

    if (fila.datos_json) {
      try {
        const parsed = JSON.parse(fila.datos_json);
        if (parsed.planillaEstaciones || parsed.actividad) {
          datosDrt = parsed;
          if (parsed.guardadoPor) {
            guardadoPorInfo = parsed.guardadoPor;
          }
        } else if (parsed.insumos || parsed.metodos || parsed.clienteRazon) {
          datosCampo = parsed;
        }
      } catch {
        datosDrt = undefined;
        datosCampo = undefined;
      }
    }

    const estaBloqueada = !!(
      datosDrt?.cerradaEnRevision ||
      fila.sync_status === 'LOCKED' ||
      fila.sync_status === 'CLOSED'
    );

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
      actualizadoEn: fila.actualizado_en,
      guardadoPor: guardadoPorInfo || (datosDrt ? {
        nombre: datosDrt.actualizadoPor || datosDrt.firmas?.personalResponsableNombre,
        cargo: datosDrt.firmas?.personalResponsableCargo,
      } : undefined),
      bloqueada: estaBloqueada,
      motivoBloqueo: estaBloqueada
        ? 'La inspección está cerrada y no acepta más sincronizaciones ni modificaciones de campo (Sección 8.2)'
        : undefined,
      syncStatus: fila.sync_status,
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
   * Guarda de forma durable el formulario completo del Acta de Servicio DRT (§2.4, §8.2).
   * Registra técnico, fecha y hora de actualización.
   */
  async guardarDrt(
    acta: ActaServicioDrt,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    const ahora = new Date().toISOString();
    const guardadoPor = {
      tecnicoId: metadata?.tecnicoId ?? metadata?.usuarioId,
      nombre: metadata?.tecnicoNombre ?? acta.firmas?.personalResponsableNombre,
      cargo: metadata?.tecnicoCargo ?? acta.firmas?.personalResponsableCargo,
    };
    // Autoría del último guardado para la fusión LWW entre técnicos (§8.2, GAF-37).
    const actaConMetadata: ActaServicioDrt = {
      ...acta,
      actualizadoEn: ahora,
      actualizadoPor:
        metadata?.tecnicoNombre ?? acta.actualizadoPor ?? acta.firmas?.personalResponsableNombre,
    };

    // El acta es la fuente de las observaciones del DRT.
    return this.guardarFormulario({
      servicioId: acta.servicioId,
      usuarioId: metadata?.usuarioId,
      clienteRazonSocial: metadata?.clienteRazonSocial ?? acta.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre ?? acta.sedeDireccion,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? 'DESRATIZACION_DRT',
      observaciones: acta.resultadosRecomendaciones || '',
      datosJson: JSON.stringify({ ...actaConMetadata, guardadoPor }),
      bloquear: !!acta.cerradaEnRevision,
    });
  }

  /**
   * Bloquea localmente un borrador cuando el servidor o un técnico colaborador cierra la inspección (§8.2).
   */
  async marcarBloqueada(
    servicioId: string,
    motivo = 'La inspección está cerrada y no acepta más sincronizaciones de campo (Sección 8.2)',
  ): Promise<void> {
    const db = this.getDb();
    const ahora = new Date().toISOString();

    // Lectura y escritura en la misma transacción: un guardado concurrente no se pierde.
    await db.withExclusiveTransactionAsync(async (tx) => {
      const fila = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ?;`,
        [servicioId],
      );
      const borradorActual = fila ? this.mapearFilaABorrador(fila) : null;

      let datosJsonActualizado: string | null = null;
      if (borradorActual?.datosDrt) {
        const actaBloqueada: ActaServicioDrt = {
          ...borradorActual.datosDrt,
          cerradaEnRevision: true,
          actualizadoEn: ahora,
        };
        datosJsonActualizado = JSON.stringify(actaBloqueada);
      }

      await tx.runAsync(
        `UPDATE borradores_inspeccion 
         SET sync_status = 'LOCKED',
             actualizado_en = ?,
             datos_json = COALESCE(?, datos_json)
         WHERE servicio_id = ?;`,
        [ahora, datosJsonActualizado, servicioId],
      );
    });
  }

  /**
   * Fusiona un borrador recibido de otro técnico colaborador aplicando la regla Last-Write-Wins (§8.2).
   */
  async fusionarBorradorRemoto(
    servicioId: string,
    actaRemota: ActaServicioDrt,
  ): Promise<BorradorInspeccion> {
    const local = await this.obtenerPorServicioId(servicioId);
    if (!local || !local.datosDrt) {
      return this.guardarDrt(actaRemota);
    }

    const { acta: actaFusionada } = fusionarActasColaborativas(local.datosDrt, actaRemota);
    return this.guardarDrt(actaFusionada, {
      clienteRazonSocial: local.clienteRazonSocial,
      sedeNombre: local.sedeNombre,
      servicioTipo: local.servicioTipo,
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
    /** Marca el borrador como LOCKED (inspección cerrada en revisión, §8.2). */
    bloquear?: boolean;
  }): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const estadoSync = datos.bloquear ? 'LOCKED' : 'PENDING_SYNC';

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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(servicio_id) DO UPDATE SET
          usuario_id = COALESCE(excluded.usuario_id, borradores_inspeccion.usuario_id),
          cliente_razon_social = COALESCE(excluded.cliente_razon_social, borradores_inspeccion.cliente_razon_social),
          sede_nombre = COALESCE(excluded.sede_nombre, borradores_inspeccion.sede_nombre),
          numero_orden = COALESCE(excluded.numero_orden, borradores_inspeccion.numero_orden),
          servicio_tipo = COALESCE(borradores_inspeccion.servicio_tipo, excluded.servicio_tipo),
          observaciones = excluded.observaciones,
          datos_json = excluded.datos_json,
          actualizado_en = excluded.actualizado_en,
          -- Una inspección bloqueada sigue bloqueada: un guardado normal no la reabre.
          sync_status = CASE
            WHEN borradores_inspeccion.sync_status IN ('LOCKED', 'CLOSED')
              THEN borradores_inspeccion.sync_status
            ELSE excluded.sync_status
          END;`,
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
          estadoSync,
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

  /**
   * Encola las operaciones (en orden) y quita el borrador del servicio en UNA transacción:
   * si la app se cierra a mitad, o quedan todos los cambios o ninguno.
   */
  private async encolarYQuitarBorrador(
    servicioId: string,
    deviceId: string,
    operaciones: Array<{
      operacion: OperacionSync;
      aggregateType: string;
      priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
    }>,
  ): Promise<void> {
    await this.getDb().withExclusiveTransactionAsync(async (tx) => {
      const outbox = new OutboxQueue(tx);
      for (const { operacion, aggregateType, priority } of operaciones) {
        await outbox.encolar(operacion, { deviceId, aggregateType, priority });
      }
      await tx.runAsync(`DELETE FROM borradores_inspeccion WHERE servicio_id = ?;`, [servicioId]);
    });
  }

  /**
   * Finaliza el servicio DRT: valida el acta, la encola en la tabla sync_outbox
   * y remueve el borrador activo localmente para dejar el terminal listo para el siguiente servicio.
   * Opcionalmente encola operaciones individuales REGISTRO_ESTACION (§5.1, GAF-35).
   */
  async finalizarYEncolarDrt(
    acta: ActaServicioDrt,
    usuarioId: string,
    deviceId = 'device-mobile-local',
    opciones?: { encolarEstacionesIndividuales?: boolean },
  ): Promise<{ operationId: string; estacionesOperacionesIds?: string[] }> {
    const parsed = ActaServicioDrtSchema.parse(acta);
    const operationId = generarUuid();
    const ahora = new Date().toISOString();

    const operacionesEstaciones: OperacionSync[] = [];
    if (opciones?.encolarEstacionesIndividuales && parsed.planillaEstaciones.length > 0) {
      for (const est of parsed.planillaEstaciones) {
        const estOpId = generarUuid();
        const opEstacion: OperacionSync = {
          operationId: estOpId,
          tipo: 'REGISTRO_ESTACION',
          agregadoId: parsed.servicioId,
          actorId: usuarioId,
          clienteTimestamp: ahora,
          payload: {
            numeroEstacion: est.numero,
            huboConsumo: est.huboConsumo ?? (est.estado === 'CON_CONSUMO'),
            porcentajeConsumo: est.porcentajeConsumo ?? 0,
            cantidadGramos: est.cantidadGramos ?? 20,
            consumoGramos: est.consumoGramos ?? 0,
            cantidadReposicion: est.cantidadReposicion ?? est.repuestoGramos ?? 0,
            tipoCebo: est.tipoCebo ?? 'BLOQUE_10G',
            lote: est.lote ?? 'LOTE-DEFAULT',
            vencimiento: est.vencimiento ?? '2026-12-31',
            estadoFisico: est.estadoFisico ?? 'BUENAS_CONDICIONES',
            esInstalacion: est.esInstalacion ?? parsed.primeraVisita ?? false,
            colorIcono: est.huboConsumo ? 'ROJO' : 'VERDE',
            colorAura: est.estadoFisico === 'MALAS_CONDICIONES' ? 'ROJO' : 'VERDE',
            observaciones: est.observaciones ?? '',
          },
        };
        operacionesEstaciones.push(opEstacion);
      }
    }

    const operacion: OperacionSync = {
      operationId,
      tipo: 'REGISTRO_SERVICIO_DRT',
      agregadoId: parsed.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: parsed as unknown as Record<string, unknown>,
    };

    // Estaciones, acta y borrado del borrador en una sola transacción: sin envíos
    // duplicados ni estaciones sueltas si la app se cierra a mitad.
    await this.encolarYQuitarBorrador(parsed.servicioId, deviceId, [
      ...operacionesEstaciones.map((op) => ({
        operacion: op,
        aggregateType: 'ESTACION_CONTROL',
        priority: 'NORMAL' as const,
      })),
      { operacion, aggregateType: 'SERVICIO_DRT', priority: 'HIGH' },
    ]);

    return {
      operationId,
      estacionesOperacionesIds:
        operacionesEstaciones.length > 0
          ? operacionesEstaciones.map((op) => op.operationId)
          : undefined,
    };
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

    await this.encolarYQuitarBorrador(cerrado.servicioId, deviceId, [
      { operacion, aggregateType: 'INSPECCION_CAMPO', priority: 'HIGH' },
    ]);

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
