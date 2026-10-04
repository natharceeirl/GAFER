import {
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
    // El actor es siempre la sesión validada por AuthGuard (que corre antes que los interceptores);
    // el encabezado x-actor ya no se acepta porque cualquiera podía suplantar a otra persona en la auditoría.
    const actor = request?.user?.usuario ?? 'desconocido';
    const url = request?.url ?? '';

    return next.handle().pipe(
      mergeMap((responseBody) =>
        from(this.procesarAuditoria(handler, request, responseBody, actor, url)).pipe(
          mergeMap(() => from(Promise.resolve(responseBody))),
        ),
      ),
    );
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
    // Solo se audita si la persona de la sesión existe en personal (la tabla exige esa referencia).
    const actorId = await this.auditoriaService.resolverActorId(req?.user?.id);

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
