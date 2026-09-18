export interface NotificationPort {
  notificar(mensaje: string, contexto?: Record<string, unknown>): Promise<void>;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
