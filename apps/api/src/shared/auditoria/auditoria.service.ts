import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from '../../database/types';
import { KYSELY_DATABASE } from '../../database/database.module';
import {
  PERSONAL_REPOSITORY,
  PersonalRepository,
} from '../../mantenimiento/domain/ports/personal.repository';

export interface EventoAuditoria {
  actor: string;
  handler: string;
  timestamp: string;
  camposModificados: unknown;
}

export interface RegistroAuditoriaParams {
  inspeccionId: string;
  actorId: string;
  accion: string;
  payloadAnterior?: Record<string, unknown> | null;
  payloadNuevo?: Record<string, unknown> | null;
}

function parseJsonb<T = Record<string, unknown>>(val: unknown, fallback: T | null = null): T | null {
  if (!val) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);
  private readonly memoriaEventos: EventoAuditoria[] = [];

  constructor(
    @Optional()
    @Inject(KYSELY_DATABASE)
    private readonly db?: Kysely<GaferDatabase>,
    @Optional()
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepo?: PersonalRepository,
  ) {}

  async registrar(evento: EventoAuditoria): Promise<void> {
    this.memoriaEventos.push(evento);
    this.logger.log(`[auditoria] ${JSON.stringify(evento)}`);
  }

  async persistirInspeccionAuditoria(params: RegistroAuditoriaParams): Promise<void> {
    if (!this.db) {
      return;
    }

    await this.db
      .insertInto('inspecciones_auditoria')
      .values({
        inspeccion_id: params.inspeccionId,
        actor_id: params.actorId,
        accion: params.accion,
        payload_anterior: params.payloadAnterior
          ? JSON.stringify(params.payloadAnterior)
          : null,
        payload_nuevo: params.payloadNuevo
          ? JSON.stringify(params.payloadNuevo)
          : null,
      })
      .execute();
  }

  async resolverActorId(actorHeader?: string): Promise<string | null> {
    if (!actorHeader || !this.personalRepo) return null;

    const trimmed = actorHeader.trim();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmed)) {
      const personal = await this.personalRepo.buscarPorId(trimmed);
      return personal ? personal.id : null;
    }

    const porUsuario = await this.personalRepo.buscarPorUsuario(trimmed.toUpperCase());
    return porUsuario ? porUsuario.id : null;
  }

  async listarPorInspeccion(inspeccionId: string) {
    if (!this.db) return [];
    return this.db
      .selectFrom('inspecciones_auditoria')
      .selectAll()
      .where('inspeccion_id', '=', inspeccionId)
      .orderBy('server_received_at', 'asc')
      .execute();
  }

  async registrarEvento(params: {
    actorId?: string | null;
    actorUsuario: string;
    actorRol: string;
    modulo: string;
    accion: string;
    entidad: string;
    entidadId: string;
    payloadAnterior?: Record<string, unknown> | null;
    payloadNuevo?: Record<string, unknown> | null;
    detalles?: Record<string, unknown>;
  }) {
    this.logger.log(
      `[auditoria:${params.modulo}] ${params.accion} sobre ${params.entidad}:${params.entidadId} por ${params.actorUsuario} (${params.actorRol})`,
    );

    if (!this.db) {
      return null;
    }

    const row = await this.db
      .insertInto('auditoria_eventos')
      .values({
        actor_id: params.actorId ?? null,
        actor_usuario: params.actorUsuario.toUpperCase(),
        actor_rol: params.actorRol,
        modulo: params.modulo,
        accion: params.accion,
        entidad: params.entidad,
        entidad_id: params.entidadId,
        payload_anterior: params.payloadAnterior
          ? JSON.stringify(params.payloadAnterior)
          : null,
        payload_nuevo: params.payloadNuevo
          ? JSON.stringify(params.payloadNuevo)
          : null,
        detalles: JSON.stringify(params.detalles ?? {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      actorId: row.actor_id,
      actorUsuario: row.actor_usuario,
      actorRol: row.actor_rol,
      modulo: row.modulo,
      accion: row.accion,
      entidad: row.entidad,
      entidadId: row.entidad_id,
      payloadAnterior: parseJsonb(row.payload_anterior),
      payloadNuevo: parseJsonb(row.payload_nuevo),
      detalles: parseJsonb(row.detalles, {})!,
      createdAt: row.created_at.toISOString(),
    };
  }

  async consultarEventos(filtros: {
    modulo?: string;
    entidad?: string;
    entidadId?: string;
    actorUsuario?: string;
    desde?: string;
    hasta?: string;
    limit?: number;
    offset?: number;
  }) {
    if (!this.db) {
      return { items: [], total: 0 };
    }

    let query = this.db.selectFrom('auditoria_eventos');

    if (filtros.modulo) {
      query = query.where('modulo', '=', filtros.modulo);
    }
    if (filtros.entidad) {
      query = query.where('entidad', '=', filtros.entidad);
    }
    if (filtros.entidadId) {
      query = query.where('entidad_id', '=', filtros.entidadId);
    }
    if (filtros.actorUsuario) {
      query = query.where(
        'actor_usuario',
        '=',
        filtros.actorUsuario.toUpperCase(),
      );
    }
    if (filtros.desde) {
      query = query.where('created_at', '>=', new Date(filtros.desde));
    }
    if (filtros.hasta) {
      const hastaFecha = new Date(filtros.hasta);
      hastaFecha.setDate(hastaFecha.getDate() + 1);
      query = query.where('created_at', '<', hastaFecha);
    }

    const countRes = await query
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .executeTakeFirst();
    const total = countRes ? parseInt(countRes.total, 10) : 0;

    const limit = filtros.limit ?? 20;
    const offset = filtros.offset ?? 0;

    const rows = await query
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    const items = rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorUsuario: row.actor_usuario,
      actorRol: row.actor_rol,
      modulo: row.modulo,
      accion: row.accion,
      entidad: row.entidad,
      entidadId: row.entidad_id,
      payloadAnterior: parseJsonb(row.payload_anterior),
      payloadNuevo: parseJsonb(row.payload_nuevo),
      detalles: parseJsonb(row.detalles, {})!,
      createdAt: row.created_at.toISOString(),
    }));

    return { items, total };
  }

  obtenerEventosMemoria(): ReadonlyArray<EventoAuditoria> {
    return this.memoriaEventos;
  }
}
