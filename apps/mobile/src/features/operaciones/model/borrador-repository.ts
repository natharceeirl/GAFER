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
  fusionarActasColaborativas,
  verificarBloqueoInspeccion,
} from './trabajo-colaborativo';
import { construirPayloadEstacionSync } from './estaciones-drt';
import {
  cerrarFormulario,
  ConfigServicioBorrador,
  FormularioCampo,
} from './formulario-campo';

interface GuardadoPorBorrador {
  tecnicoId?: string;
  nombre?: string;
  cargo?: string;
}

interface DatosBorradorJson {
  datosDrt?: ActaServicioDrt;
  datosCampo?: FormularioCampo;
  configServicio?: ConfigServicioBorrador;
  guardadoPor?: GuardadoPorBorrador;
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

    if (
      'datosDrt' in parsed ||
      'datosCampo' in parsed ||
      'configServicio' in parsed ||
      ('guardadoPor' in parsed && !('planillaEstaciones' in parsed) && !('actividad' in parsed))
    ) {
      return {
        datosDrt: parsed.datosDrt as ActaServicioDrt | undefined,
        datosCampo: parsed.datosCampo as FormularioCampo | undefined,
        configServicio: parsed.configServicio as ConfigServicioBorrador | undefined,
        guardadoPor: parsed.guardadoPor as GuardadoPorBorrador | undefined,
      };
    }

    // Retrocompatibilidad con filas guardadas sin envoltorio compuesto.
    if (parsed.planillaEstaciones || parsed.actividad) {
      const { guardadoPor, ...restoDrt } = parsed as ActaServicioDrt & {
        guardadoPor?: GuardadoPorBorrador;
      };
      return {
        datosDrt: restoDrt as ActaServicioDrt,
        guardadoPor,
      };
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
    const {
      datosDrt,
      datosCampo,
      configServicio,
      guardadoPor: guardadoPorInfo,
    } = parsearDatosJson(fila.datos_json);

    const bloqueo = verificarBloqueoInspeccion({
      ...datosDrt,
      syncStatus: fila.sync_status,
    });
    const estaBloqueada = bloqueo.bloqueada;

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
      actualizadoEn: fila.actualizado_en,
      guardadoPor:
        guardadoPorInfo ||
        (datosDrt
          ? {
              nombre: datosDrt.actualizadoPor || datosDrt.firmas?.personalResponsableNombre,
              cargo: datosDrt.firmas?.personalResponsableCargo,
            }
          : undefined),
      bloqueada: estaBloqueada,
      motivoBloqueo: estaBloqueada
        ? (bloqueo.motivo ??
          'La inspección está cerrada y no acepta más sincronizaciones ni modificaciones de campo (Sección 8.2)')
        : undefined,
      syncStatus: fila.sync_status,
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
   * - Si ya existe y está bloqueado (`LOCKED`/`CLOSED`), se devuelve intacto sin modificarlo.
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
      const filaExistente = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [servicioId, usuarioId],
      );
      if (filaExistente) {
        const borradorExistente = this.mapearFilaABorrador(filaExistente);
        if (borradorExistente.bloqueada) {
          return borradorExistente;
        }
      }

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
          actualizado_en = excluded.actualizado_en
        WHERE borradores_inspeccion.sync_status NOT IN ('LOCKED', 'CLOSED');`,
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
   * Guarda de forma durable el formulario completo del Acta de Servicio DRT (§2.4, §8.2).
   * Registra técnico, fecha y hora de actualización, y preserva `datosCampo` y `configServicio`
   * coexistentes para el mismo `(servicio_id, usuario_id)`.
   */
  async guardarDrt(
    acta: ActaServicioDrt,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    const ahora = new Date().toISOString();
    const guardadoPor: GuardadoPorBorrador = {
      tecnicoId: metadata?.tecnicoId ?? metadata?.usuarioId,
      nombre: metadata?.tecnicoNombre ?? acta.actualizadoPor ?? acta.firmas?.personalResponsableNombre,
      cargo: metadata?.tecnicoCargo ?? acta.firmas?.personalResponsableCargo,
    };
    // Autoría del último guardado para la fusión LWW entre técnicos (§8.2, GAF-37).
    const actaConMetadata: ActaServicioDrt = {
      ...acta,
      actualizadoEn: ahora,
      actualizadoPor:
        metadata?.tecnicoNombre ?? acta.actualizadoPor ?? acta.firmas?.personalResponsableNombre,
    };

    return this.guardarFormulario({
      servicioId: acta.servicioId,
      usuarioId: metadata?.usuarioId,
      clienteRazonSocial: metadata?.clienteRazonSocial ?? acta.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre ?? acta.sedeDireccion,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? 'DESRATIZACION_DRT',
      observaciones: acta.resultadosRecomendaciones || '',
      datosDrt: actaConMetadata,
      configServicio: metadata?.configServicio,
      guardadoPor,
      bloquear: Boolean(acta.cerradaEnRevision),
    });
  }

  /**
   * Bloquea localmente un borrador (o todos los borradores del servicio en este dispositivo)
   * cuando el servidor o un técnico colaborador cierra la inspección (§8.2).
   */
  async marcarBloqueada(
    servicioId: string,
    opciones?: string | { usuarioId?: string; cerradoPor?: string; motivo?: string },
  ): Promise<void> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const opts = typeof opciones === 'string' ? { motivo: opciones } : (opciones ?? {});

    // Lectura y escritura en la misma transacción: un guardado concurrente no se pierde.
    await db.withExclusiveTransactionAsync(async (tx) => {
      const filas =
        opts.usuarioId !== undefined
          ? await tx.getAllAsync<FilaBorradorDb>(
              `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
              [servicioId, opts.usuarioId],
            )
          : await tx.getAllAsync<FilaBorradorDb>(
              `SELECT * FROM borradores_inspeccion WHERE servicio_id = ?;`,
              [servicioId],
            );

      for (const fila of filas) {
        const combinado = parsearDatosJson(fila.datos_json);
        let datosJsonActualizado: string | null = fila.datos_json;
        if (combinado.datosDrt) {
          combinado.datosDrt = {
            ...combinado.datosDrt,
            cerradaEnRevision: true,
            ...(opts.cerradoPor ? { cerradoPor: opts.cerradoPor } : {}),
            actualizadoEn: ahora,
          };
          datosJsonActualizado = JSON.stringify(combinado);
        }

        await tx.runAsync(
          `UPDATE borradores_inspeccion
           SET sync_status = 'LOCKED',
               actualizado_en = ?,
               datos_json = COALESCE(?, datos_json)
           WHERE servicio_id = ? AND usuario_id = ?;`,
          [ahora, datosJsonActualizado, servicioId, fila.usuario_id ?? ''],
        );
      }
    });
  }

  /**
   * Fusiona de forma atómica un borrador recibido de otro técnico colaborador aplicando la regla
   * Last-Write-Wins (§8.2) dentro de una única transacción exclusiva para evitar carreras con auto-guardado.
   */
  async fusionarBorradorRemoto(
    servicioId: string,
    actaRemota: ActaServicioDrt,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const propietario = metadata?.usuarioId ?? '';

    return db.withExclusiveTransactionAsync(async (tx) => {
      const filaPrevia = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [servicioId, propietario],
      );

      if (filaPrevia) {
        const borradorLocal = this.mapearFilaABorrador(filaPrevia);
        // Si el borrador local ya está bloqueado/cerrado, es inmutable (§8.2).
        if (borradorLocal.bloqueada) {
          return borradorLocal;
        }
      }

      const combinado = parsearDatosJson(filaPrevia?.datos_json ?? null);
      let actaFinal: ActaServicioDrt;
      let fueBloqueada: boolean;

      if (combinado.datosDrt) {
        const resultadoFusion = fusionarActasColaborativas(combinado.datosDrt, actaRemota);
        actaFinal = resultadoFusion.acta;
        fueBloqueada = resultadoFusion.fueBloqueada;
      } else {
        const bloqueoRemoto = verificarBloqueoInspeccion(actaRemota);
        fueBloqueada = bloqueoRemoto.bloqueada;
        actaFinal = {
          ...actaRemota,
          servicioId,
          cerradaEnRevision: fueBloqueada || actaRemota.cerradaEnRevision,
          actualizadoEn: actaRemota.actualizadoEn ?? ahora,
        };
      }

      const guardadoPor: GuardadoPorBorrador = {
        tecnicoId: metadata?.tecnicoId ?? metadata?.usuarioId ?? combinado.guardadoPor?.tecnicoId,
        nombre:
          metadata?.tecnicoNombre ??
          actaRemota.actualizadoPor ??
          combinado.guardadoPor?.nombre ??
          actaFinal.firmas?.personalResponsableNombre,
        cargo:
          metadata?.tecnicoCargo ??
          combinado.guardadoPor?.cargo ??
          actaFinal.firmas?.personalResponsableCargo,
      };

      combinado.datosDrt = {
        ...actaFinal,
        actualizadoEn: ahora,
        actualizadoPor:
          actaFinal.actualizadoPor ??
          actaRemota.actualizadoPor ??
          guardadoPor.nombre,
      };
      if (metadata?.configServicio !== undefined) {
        combinado.configServicio = metadata.configServicio;
      }
      combinado.guardadoPor = guardadoPor;

      const estadoSync = fueBloqueada ? 'LOCKED' : 'PENDING_SYNC';
      const observaciones = actaFinal.resultadosRecomendaciones || filaPrevia?.observaciones || '';

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
          sync_status = excluded.sync_status
        WHERE borradores_inspeccion.sync_status NOT IN ('LOCKED', 'CLOSED');`,
        [
          servicioId,
          propietario,
          metadata?.clienteRazonSocial ?? filaPrevia?.cliente_razon_social ?? actaFinal.clienteRazonSocial ?? null,
          metadata?.sedeNombre ?? filaPrevia?.sede_nombre ?? actaFinal.sedeDireccion ?? null,
          metadata?.numeroOrden ?? filaPrevia?.numero_orden ?? null,
          metadata?.servicioTipo ?? filaPrevia?.servicio_tipo ?? 'DESRATIZACION_DRT',
          observaciones,
          JSON.stringify(combinado),
          ahora,
          estadoSync,
        ],
      );

      if (fueBloqueada) {
        await tx.runAsync(
          `UPDATE borradores_inspeccion
           SET sync_status = 'LOCKED', actualizado_en = ?
           WHERE servicio_id = ? AND usuario_id != ?;`,
          [ahora, servicioId, propietario],
        );
      }

      const filaActualizada = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [servicioId, propietario],
      );
      if (!filaActualizada) {
        throw new Error(`No se pudo fusionar el borrador del servicio ${servicioId}`);
      }
      return this.mapearFilaABorrador(filaActualizada);
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
   * Si el borrador ya se encuentra bloqueado (`LOCKED`/`CLOSED` o `cerradaEnRevision`),
   * no se muta ninguna columna y se devuelve el registro bloqueado intacto (§8.2).
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
    guardadoPor?: GuardadoPorBorrador;
    /** Marca el borrador como LOCKED (inspección cerrada en revisión, §8.2). */
    bloquear?: boolean;
  }): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const propietario = datos.usuarioId ?? '';
    const estadoSync = datos.bloquear ? 'LOCKED' : 'PENDING_SYNC';

    return db.withExclusiveTransactionAsync(async (tx) => {
      const previa = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [datos.servicioId, propietario],
      );
      if (previa) {
        const borradorPrevio = this.mapearFilaABorrador(previa);
        if (borradorPrevio.bloqueada) {
          return borradorPrevio;
        }
      }

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
      if (datos.guardadoPor !== undefined) {
        combinado.guardadoPor = datos.guardadoPor;
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
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
          sync_status = excluded.sync_status
        WHERE borradores_inspeccion.sync_status NOT IN ('LOCKED', 'CLOSED');`,
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
          estadoSync,
        ],
      );

      if (datos.bloquear) {
        await tx.runAsync(
          `UPDATE borradores_inspeccion
           SET sync_status = 'LOCKED', actualizado_en = ?
           WHERE servicio_id = ? AND usuario_id != ?;`,
          [ahora, datos.servicioId, propietario],
        );
      }

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

  /**
   * Encola las operaciones (en orden) y quita el borrador del servicio en UNA transacción:
   * si la app se cierra a mitad, o quedan todos los cambios o ninguno.
   */
  private async encolarYQuitarBorrador(
    servicioId: string,
    usuarioId: string,
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
      await tx.runAsync(
        `DELETE FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [servicioId, usuarioId],
      );
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
    const actaCerrada: ActaServicioDrt = {
      ...parsed,
      cerradaEnRevision: true,
      cerradoPor: parsed.cerradoPor || parsed.firmas.personalResponsableNombre,
      actualizadoEn: parsed.actualizadoEn || ahora,
    };

    const operacionesEstaciones: OperacionSync[] = [];
    if (opciones?.encolarEstacionesIndividuales && actaCerrada.planillaEstaciones.length > 0) {
      for (const est of actaCerrada.planillaEstaciones) {
        const estOpId = generarUuid();
        const payloadEstacion = construirPayloadEstacionSync(est, Boolean(actaCerrada.primeraVisita));
        const opEstacion: OperacionSync = OperacionSyncSchema.parse({
          operationId: estOpId,
          tipo: 'REGISTRO_ESTACION',
          agregadoId: actaCerrada.servicioId,
          actorId: usuarioId,
          clienteTimestamp: ahora,
          payload: payloadEstacion as unknown as Record<string, unknown>,
        });
        operacionesEstaciones.push(opEstacion);
      }
    }

    const operacion: OperacionSync = OperacionSyncSchema.parse({
      operationId,
      tipo: 'REGISTRO_SERVICIO_DRT',
      agregadoId: actaCerrada.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: actaCerrada as unknown as Record<string, unknown>,
    });

    // Estaciones, acta y borrado del borrador en una sola transacción: sin envíos
    // duplicados ni estaciones sueltas si la app se cierra a mitad.
    await this.encolarYQuitarBorrador(actaCerrada.servicioId, usuarioId, deviceId, [
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

    await this.encolarYQuitarBorrador(cerrado.servicioId, usuarioId, deviceId, [
      { operacion, aggregateType: 'INSPECCION_CAMPO', priority: 'HIGH' },
    ]);

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

    const resultado = await db.withExclusiveTransactionAsync(async (tx) => {
      const previa = await tx.getFirstAsync<FilaBorradorDb>(
        `SELECT * FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        [servicioId, propietario],
      );
      if (previa && this.mapearFilaABorrador(previa).bloqueada) {
        throw new Error(
          'La inspección está cerrada y bloqueada contra modificaciones (Sección 8.2)',
        );
      }
      return tx.runAsync(
        `UPDATE borradores_inspeccion
         SET observaciones = ?, actualizado_en = ?
         WHERE servicio_id = ? AND usuario_id = ? AND sync_status NOT IN ('LOCKED', 'CLOSED');`,
        [observaciones, ahora, servicioId, propietario],
      );
    });

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
