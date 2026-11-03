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
   * Guarda de forma durable el formulario completo del Acta de Servicio DRT (§2.4).
   */
  async guardarDrt(
    acta: ActaServicioDrt,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const datosJson = JSON.stringify(acta);

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT OR REPLACE INTO borradores_inspeccion (
          servicio_id,
          cliente_razon_social,
          sede_nombre,
          numero_orden,
          servicio_tipo,
          observaciones,
          datos_json,
          actualizado_en,
          server_version,
          sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_SYNC');`,
        [
          acta.servicioId,
          metadata?.clienteRazonSocial ?? acta.clienteRazonSocial,
          metadata?.sedeNombre ?? acta.sedeDireccion,
          metadata?.numeroOrden ?? null,
          metadata?.servicioTipo ?? 'DESRATIZACION_DRT',
          acta.resultadosRecomendaciones || '',
          datosJson,
          ahora,
        ],
      );
    });

    return {
      servicioId: acta.servicioId,
      observaciones: acta.resultadosRecomendaciones || '',
      clienteRazonSocial: metadata?.clienteRazonSocial ?? acta.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre ?? acta.sedeDireccion,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? 'DESRATIZACION_DRT',
      datosDrt: acta,
    };
  }

  /**
   * Guarda de forma durable el formulario de campo por bloques (§4, §8.2).
   */
  async guardarCampo(
    formulario: FormularioCampo,
    metadata?: MetadataBorrador,
  ): Promise<BorradorInspeccion> {
    const db = this.getDb();
    const ahora = new Date().toISOString();
    const datosJson = JSON.stringify(formulario);
    const observaciones =
      formulario.observacionesLibre ||
      (formulario.observaciones.length > 0 ? formulario.observaciones.join('. ') : '');

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT OR REPLACE INTO borradores_inspeccion (
          servicio_id,
          cliente_razon_social,
          sede_nombre,
          numero_orden,
          servicio_tipo,
          observaciones,
          datos_json,
          actualizado_en,
          server_version,
          sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_SYNC');`,
        [
          formulario.servicioId,
          metadata?.clienteRazonSocial ?? formulario.clienteRazon,
          metadata?.sedeNombre ?? formulario.proyectoNombre,
          metadata?.numeroOrden ?? null,
          metadata?.servicioTipo ?? formulario.servicioEtiqueta,
          observaciones,
          datosJson,
          ahora,
        ],
      );
    });

    return {
      servicioId: formulario.servicioId,
      observaciones,
      clienteRazonSocial: metadata?.clienteRazonSocial ?? formulario.clienteRazon,
      sedeNombre: metadata?.sedeNombre ?? formulario.proyectoNombre,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? formulario.servicioEtiqueta,
      datosCampo: formulario,
    };
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

    const db = this.getDb();
    const outbox = new OutboxQueue(db);

    let estacionesOperacionesIds: string[] | undefined;
    if (opciones?.encolarEstacionesIndividuales && parsed.planillaEstaciones.length > 0) {
      estacionesOperacionesIds = [];
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
        await outbox.encolar(opEstacion, {
          deviceId,
          aggregateType: 'ESTACION_CONTROL',
          priority: 'NORMAL',
        });
        estacionesOperacionesIds.push(estOpId);
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

    await outbox.encolar(operacion, {
      deviceId,
      aggregateType: 'SERVICIO_DRT',
      priority: 'HIGH',
    });

    await this.eliminar(parsed.servicioId);

    return { operationId, estacionesOperacionesIds };
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

    const db = this.getDb();
    const outbox = new OutboxQueue(db);

    const operacion: OperacionSync = {
      operationId,
      tipo: 'REGISTRO_SERVICIO_CAMPO',
      agregadoId: cerrado.servicioId,
      actorId: usuarioId,
      clienteTimestamp: ahora,
      payload: cerrado as unknown as Record<string, unknown>,
    };

    await outbox.encolar(operacion, {
      deviceId,
      aggregateType: 'INSPECCION_CAMPO',
      priority: 'HIGH',
    });

    await this.eliminar(cerrado.servicioId);

    return { operationId };
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
