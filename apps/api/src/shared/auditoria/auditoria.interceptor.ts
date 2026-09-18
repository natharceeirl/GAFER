import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

export interface EventoAuditoria {
  actor: string;
  handler: string;
  timestamp: string;
  camposModificados: unknown;
}

/**
 * Interceptor transversal de auditoría.
 *
 * Se instala globalmente desde el arranque de la aplicación (ver app.module.ts)
 * en lugar de agregarse módulo por módulo más adelante: el log de auditoría
 * (sección 8.4 de la especificación) debe existir desde la primera fase, o no
 * queda rastro de lo que pasó en campo durante Fases 1-3.
 *
 * El sink actual es en memoria/consola como placeholder de scaffolding.
 * TODO: reemplazar `registrar()` por una escritura persistente e inmutable
 * (tabla append-only en Postgres) antes de producción.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly eventos: EventoAuditoria[] = [];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler().name;
    const request = context.switchToHttp().getRequest();
    const actor = request?.headers?.['x-actor'] ?? 'desconocido';

    return next.handle().pipe(
      tap(() => {
        this.registrar({
          actor,
          handler,
          timestamp: new Date().toISOString(),
          camposModificados: request?.body ?? null,
        });
      }),
    );
  }

  private registrar(evento: EventoAuditoria): void {
    this.eventos.push(evento);
    // eslint-disable-next-line no-console
    console.log('[auditoria]', JSON.stringify(evento));
  }

  obtenerEventos(): ReadonlyArray<EventoAuditoria> {
    return this.eventos;
  }
}
