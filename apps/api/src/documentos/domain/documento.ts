export type EstadoDocumento =
  | 'BORRADOR'
  | 'CERRADO'
  | 'ENVIADO_A_REVISION'
  | 'OBSERVADO'
  | 'APROBADO'
  | 'ENVIADO';

const TRANSICIONES_PERMITIDAS: Record<EstadoDocumento, EstadoDocumento[]> = {
  BORRADOR: ['CERRADO'],
  CERRADO: ['ENVIADO_A_REVISION'],
  ENVIADO_A_REVISION: ['OBSERVADO', 'APROBADO'],
  OBSERVADO: ['ENVIADO_A_REVISION'],
  APROBADO: ['ENVIADO'],
  ENVIADO: [],
};

export class Documento {
  private estado: EstadoDocumento = 'BORRADOR';

  constructor(
    public readonly id: string,
    public readonly clienteId: string,
    public readonly numeroCorrelativo: number,
  ) {}

  transicionarA(nuevoEstado: EstadoDocumento): void {
    const permitidas = TRANSICIONES_PERMITIDAS[this.estado];
    if (!permitidas.includes(nuevoEstado)) {
      throw new Error(`No se puede pasar de ${this.estado} a ${nuevoEstado}`);
    }
    this.estado = nuevoEstado;
  }

  getEstado(): EstadoDocumento {
    return this.estado;
  }
}
