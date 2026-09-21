import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AuditoriaService, EventoAuditoria } from './auditoria.service';

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler().name;
    const request = context.switchToHttp().getRequest();
    const actor = request?.headers?.['x-actor'] ?? 'desconocido';
    const url = request?.url ?? '';

    return from(this.validarActorSiPresente(url, request?.headers?.['x-actor'])).pipe(
      mergeMap(() =>
        next.handle().pipe(
          mergeMap((responseBody) =>
            from(this.procesarAuditoria(handler, request, responseBody, actor, url)).pipe(
              mergeMap(() => from(Promise.resolve(responseBody))),
            ),
          ),
        ),
      ),
    );
  }

  private async validarActorSiPresente(url: string, actorHeader?: string): Promise<void> {
    if (actorHeader && url.includes('/operaciones/inspecciones')) {
      const actorId = await this.auditoriaService.resolverActorId(actorHeader);
      if (!actorId) {
        throw new BadRequestException(
          `El encabezado x-actor '${actorHeader}' no corresponde a un personal técnico registrado`,
        );
      }
    }
  }

  private async procesarAuditoria(
    handler: string,
    req: any,
    res: any,
    actor: string,
    url: string,
  ): Promise<void> {
    await this.auditoriaService.registrar({
      actor,
      handler,
      timestamp: new Date().toISOString(),
      camposModificados: req?.body ?? null,
    });

    if (url.includes('/operaciones/inspecciones')) {
      await this.manejarAuditoriaInspeccion(handler, req, res);
    }
  }

  // TECH-DEBT / REFACTOR PENDING:
  // Alcance provisorio Fase 1: Inferencia de acción y entidad mediante strings de handler name y URL.
  // Justificación: Provee auditoría concurrente inmediata sin requerir infraestructura previa de decoradores o Domain Events.
  // Migración programada:
  // 1. Implementar decorador declarativo @Auditable({ entidad: 'INSPECCION', accion: 'CREACION' | 'CIERRE' }) o EventEmitter de dominio.
  // 2. Extraer los metadatos de auditoría limpiamente sin acoplarse al nombre del método del controlador.
  private async manejarAuditoriaInspeccion(handler: string, req: any, res: any): Promise<void> {
    const actorHeader = req?.headers?.['x-actor'];
    let actorId = await this.auditoriaService.resolverActorId(actorHeader);

    // Si no vino en header pero vino en el payload (ej. personalIds de cierre)
    if (!actorId && req?.body?.personalIds && req.body.personalIds.length > 0) {
      actorId = await this.auditoriaService.resolverActorId(req.body.personalIds[0]);
    }

    if (!actorId) {
      return;
    }

    let inspeccionId = req?.params?.id;
    let accion = 'OPERACION';
    let payloadAnterior: any = null;
    let payloadNuevo: any = req?.body ?? null;

    if (handler === 'crear') {
      inspeccionId = res?.id;
      accion = 'CREACION';
    } else if (handler === 'cerrar') {
      accion = 'CIERRE';
      payloadNuevo = {
        consumos: req?.body?.consumos,
        equiposIds: req?.body?.equiposIds,
        personalIds: req?.body?.personalIds,
      };
    }

    if (inspeccionId) {
      await this.auditoriaService.persistirInspeccionAuditoria({
        inspeccionId,
        actorId,
        accion,
        payloadAnterior,
        payloadNuevo,
      });
    }
  }

  obtenerEventos(): ReadonlyArray<EventoAuditoria> {
    return this.auditoriaService.obtenerEventosMemoria();
  }
}
