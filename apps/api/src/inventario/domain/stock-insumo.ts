/**
 * Módulo agregado durante el análisis de arquitectura de esta conversación:
 * no figura explícito en la especificación v6, pero el criterio de
 * aceptación de Fase 5 ("descuento automático + alertas de stock bajo")
 * exige modelar CANTIDADES, algo que `mantenimiento` no cubre — ese
 * módulo solo define qué insumos existen, no cuánto queda de cada uno.
 */
export class StockInsumo {
  constructor(
    public readonly insumoId: string,
    private cantidadDisponible: number,
    private readonly umbralMinimo: number,
  ) {}

  descontar(cantidad: number): void {
    if (cantidad <= 0) {
      throw new Error('La cantidad a descontar debe ser positiva');
    }
    if (cantidad > this.cantidadDisponible) {
      throw new Error(
        `Stock insuficiente: disponible ${this.cantidadDisponible}, se pidió descontar ${cantidad}`,
      );
    }
    this.cantidadDisponible -= cantidad;
  }

  necesitaAlerta(): boolean {
    return this.cantidadDisponible <= this.umbralMinimo;
  }

  getCantidadDisponible(): number {
    return this.cantidadDisponible;
  }
}
