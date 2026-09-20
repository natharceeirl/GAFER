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

  obtenerEventosMemoria(): ReadonlyArray<EventoAuditoria> {
    return this.memoriaEventos;
  }
}
