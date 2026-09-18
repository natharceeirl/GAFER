export type EstadoActivoInactivo = 'ACTIVO' | 'INACTIVO';

/**
 * Catálogo editable (sección 7.4/7.7): define QUÉ productos existen y su
 * dosis referencial. La CANTIDAD en stock no vive acá — ver el módulo
 * `inventario`, que lee este catálogo pero no lo duplica.
 */
export class Insumo {
  constructor(
    public readonly id: string,
    public readonly nombreProducto: string,
    public readonly registroDigesa: string,
    public readonly dosisReferencial: string,
    private estado: EstadoActivoInactivo = 'ACTIVO',
  ) {}

  desactivar(): void {
    this.estado = 'INACTIVO';
  }

  getEstado(): EstadoActivoInactivo {
    return this.estado;
  }
}
