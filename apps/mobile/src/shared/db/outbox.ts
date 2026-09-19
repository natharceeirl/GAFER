export interface OutboxOperation<T = unknown> {
  id: string; // UUID v4 generado en el móvil
  tipo: 'REGISTRO_ESTACION' | 'CIERRE_INSPECCION' | 'SUBIR_FOTO';
  agregadoId: string;
  payload: T;
  creadoEn: string;
  intentos: number;
  sincronizado: boolean;
}

export class OutboxQueue {
  private cola: OutboxOperation[] = [];

  encolar<T>(tipo: OutboxOperation<T>['tipo'], agregadoId: string, payload: T): OutboxOperation<T> {
    const operacion: OutboxOperation<T> = {
      id: crypto.randomUUID(),
      tipo,
      agregadoId,
      payload,
      creadoEn: new Date().toISOString(),
      intentos: 0,
      sincronizado: false,
    };
    this.cola.push(operacion as OutboxOperation);
    return operacion;
  }

  obtenerPendientes(): OutboxOperation[] {
    return this.cola.filter((op) => !op.sincronizado);
  }

  marcarSincronizado(id: string): void {
    const op = this.cola.find((o) => o.id === id);
    if (op) {
      op.sincronizado = true;
    }
  }

  limpiarSincronizados(): void {
    this.cola = this.cola.filter((op) => !op.sincronizado);
  }
}
