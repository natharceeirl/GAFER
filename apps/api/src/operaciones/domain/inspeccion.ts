export type EstadoInspeccion = 'BORRADOR' | 'CERRADO';

/**
 * Aggregate de dominio, libre de framework: sin decoradores de NestJS,
 * sin dependencias de ORM. El límite hexagonal se cumple en el código,
 * no solo en la convención de carpetas.
 *
 * El flujo de aprobación (ENVIADO_A_REVISION -> APROBADO -> ENVIADO)
 * pertenece al módulo `documentos`, no a `operaciones`: ese corte
 * coincide con el límite Fase 1 / Fase 2 de la hoja de ruta.
 */
export class Inspeccion {
  private estado: EstadoInspeccion = 'BORRADOR';

  constructor(
    public readonly id: string,
    public readonly servicioId: string,
  ) {}

  cerrar(): void {
    if (this.estado === 'CERRADO') {
      throw new Error('La inspección ya está cerrada');
    }
    this.estado = 'CERRADO';
  }

  getEstado(): EstadoInspeccion {
    return this.estado;
  }
}
