import { Injectable } from '@nestjs/common';
import { NotificationPort } from '../ports/notification.port';

// TODO: reemplazar por un adapter real (email/push) antes de producción.
@Injectable()
export class NotificationConsole implements NotificationPort {
  async notificar(mensaje: string, contexto?: Record<string, unknown>): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('[notificacion]', mensaje, contexto ?? {});
  }
}
