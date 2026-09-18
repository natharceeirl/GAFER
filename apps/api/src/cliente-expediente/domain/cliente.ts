export type EstadoActivoInactivo = 'ACTIVO' | 'INACTIVO';

export class Cliente {
  constructor(
    public readonly id: string,
    public readonly codigoCorto: string,
    public readonly razonSocial: string,
    private estado: EstadoActivoInactivo = 'ACTIVO',
  ) {
    if (!/^[A-Z0-9]{4,10}$/.test(codigoCorto)) {
      throw new Error('El código corto debe tener 4 a 10 caracteres en mayúsculas (ej. KALLPA)');
    }
  }

  desactivar(): void {
    this.estado = 'INACTIVO';
  }

  getEstado(): EstadoActivoInactivo {
    return this.estado;
  }
}
