import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../database/types';
import { KYSELY_DATABASE } from '../../database/database.module';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../domain/ports/inspeccion.repository';
import {
  PERSONAL_REPOSITORY,
  PersonalRepository,
} from '../../mantenimiento/domain/ports/personal.repository';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';
import {
  OperacionSync,
  LoteSyncResponse,
  ConflictoSync,
} from '@gafer/contracts';

/**
 * Mutex asíncrono por clave para serializar sincronizaciones sobre la misma inspección.
 * Resuelve BUG-08 (condición de carrera en idempotencia y colisiones) sin agotar
 * el pool de conexiones de PostgreSQL.
 */
class KeyedMutex {
  private chains = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const current = this.chains.get(key) ?? Promise.resolve();

    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.chains.set(key, current.then(() => next, () => next));

    try {
      await current;
      return await task();
    } finally {
      release();
      if (this.chains.get(key) === next) {
        this.chains.delete(key);
      }
    }
  }
}

@Injectable()
export class SincronizarInspeccionUseCase {
  private readonly mutex = new KeyedMutex();

  constructor(
    @Inject(INSPECCION_REPOSITORY)
    private readonly inspeccionRepo: InspeccionRepository,
    @Optional()
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepo?: PersonalRepository,
    @Optional()
    private readonly auditoriaService?: AuditoriaService,
    @Optional()
    @Inject(KYSELY_DATABASE)
    private readonly db?: Kysely<GaferDatabase>,
  ) {}

  async ejecutar(inspeccionId: string, operaciones: OperacionSync[]): Promise<LoteSyncResponse> {
    return this.mutex.runExclusive(inspeccionId, () =>
      this.procesarSincronizacion(inspeccionId, operaciones),
    );
  }

  private async procesarSincronizacion(
    inspeccionId: string,
    operaciones: OperacionSync[],
  ): Promise<LoteSyncResponse> {

    const inspeccion = await this.inspeccionRepo.buscarPorId(inspeccionId);
    if (!inspeccion) {
      throw new NotFoundException(`Inspección ${inspeccionId} no encontrada`);
    }

    if (inspeccion.getEstado() === 'CERRADO') {
      throw new ConflictException(
        'La inspección está cerrada y no acepta más sincronizaciones de campo (Sección 8.2)',
      );
    }

    const procesadas: string[] = [];
    const omitidasIdempotentes: string[] = [];
    const conflictos: ConflictoSync[] = [];
    const serverReceivedAt = new Date().toISOString();

    // Consultamos operaciones ya registradas en inspecciones_auditoria para verificar idempotencia
    let auditoriaPrevia: any[] = [];
    if (this.auditoriaService) {
      auditoriaPrevia = await this.auditoriaService.listarPorInspeccion(inspeccionId);
    } else if (this.db) {
      auditoriaPrevia = await this.db
        .selectFrom('inspecciones_auditoria')
        .selectAll()
        .where('inspeccion_id', '=', inspeccionId)
        .orderBy('server_received_at', 'asc')
        .execute();
    }

    // TECH-DEBT (Fase 3 - Mapa Murino):
    // Alcance provisorio Fase 1: Reconstrucción de estado previo de estaciones directamente desde 'inspecciones_auditoria'.
    // Justificación: La entidad y tabla persistida de Estaciones pertenece a Fase 3.
    // Migración programada (Fase 3):
    // 1. Sustituir esta proyección de auditoría por consultas al nuevo EstacionRepository.
    // 2. Persistir cada cambio de estación en su tabla de dominio dedicada (mapa_murino_estaciones).
    // Mapa de último valor por número de estación
    const estacionesMap = new Map<number, { payload: any; actorId: string }>();
    const operacionesVistas = new Set<string>();

    for (const fila of auditoriaPrevia) {
      const payload = typeof fila.payload_nuevo === 'string'
        ? JSON.parse(fila.payload_nuevo)
        : (fila.payload_nuevo ?? {});

      if (payload?.operationId) {
        operacionesVistas.add(payload.operationId);
      }
      if (payload?.numeroEstacion !== undefined) {
        estacionesMap.set(payload.numeroEstacion, { payload, actorId: fila.actor_id });
      }
    }

    for (const op of operaciones) {
      // 1. Idempotencia
      if (operacionesVistas.has(op.operationId)) {
        omitidasIdempotentes.push(op.operationId);
        continue;
      }

      // 2. Validación del técnico
      if (this.personalRepo) {
        const actor = await this.personalRepo.buscarPorId(op.actorId);
        if (!actor) {
          throw new BadRequestException(
            `El actor con ID ${op.actorId} en la operación ${op.operationId} no existe en el personal`,
          );
        }
      }

      // 3. Resolución de colisiones (sobre misma estación)
      const numeroEstacion = op.payload?.numeroEstacion as number | undefined;
      let payloadAnterior: Record<string, unknown> | null = null;

      if (numeroEstacion !== undefined && estacionesMap.has(numeroEstacion)) {
        const previa = estacionesMap.get(numeroEstacion)!;
        payloadAnterior = previa.payload;
        conflictos.push({
          operationId: op.operationId,
          motivo: `Colisión en estación ${numeroEstacion}: prevalece actualización más reciente`,
          valorDesplazado: payloadAnterior,
        });
      }

      // Actualizamos el mapa en memoria para operaciones dentro del mismo lote
      if (numeroEstacion !== undefined) {
        estacionesMap.set(numeroEstacion, { payload: op.payload, actorId: op.actorId });
      }

      // 4. Persistir en auditoría con su operationId
      const payloadNuevo = {
        ...op.payload,
        operationId: op.operationId,
        clienteTimestamp: op.clienteTimestamp,
      };

      if (this.auditoriaService) {
        try {
          await this.auditoriaService.persistirInspeccionAuditoria({
            inspeccionId,
            actorId: op.actorId,
            accion: op.tipo,
            payloadAnterior,
            payloadNuevo,
          });
          operacionesVistas.add(op.operationId);
          procesadas.push(op.operationId);
        } catch (error: any) {
          // BUG-08: Captura de violación de unicidad por índice único
          if (
            error?.code === '23505' ||
            error?.message?.includes('duplicate key') ||
            error?.message?.includes('unique constraint') ||
            error?.message?.includes('idx_auditoria_inspeccion_operation_id')
          ) {
            omitidasIdempotentes.push(op.operationId);
            continue;
          }
          throw error;
        }
      } else {
        operacionesVistas.add(op.operationId);
        procesadas.push(op.operationId);
      }
    }

    return {
      inspeccionId,
      procesadas,
      omitidasIdempotentes,
      conflictos,
      serverReceivedAt,
    };
  }
}
