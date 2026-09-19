export type EstadoInspeccion =
  | 'BORRADOR'
  | 'CERRADO'
  | 'ENVIADO_A_REVISION'
  | 'OBSERVADO'
  | 'APROBADO';

export interface InsumoSnapshotItem {
  insumoId: string;
  nombreHistorico: string;
  principioActivo: string;
  presentacion: string;
  unidadMedida: string;
  registroDigesa: string;
  concentracion: string;
  dosisAplicada: string;
  lote: string;
  cantidadUtilizada: number;
}

export interface InspeccionProps {
  id: string;
  servicioId: string;
  codigoInspeccion: string;
  fechaEjecucion: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  tecnicosParticipantes?: Array<{ id: string; nombre: string }>;
  snapshotCatalogos?: Record<string, unknown>;
  versionSync?: number;
  estado?: EstadoInspeccion;
}

export class Inspeccion {
  public readonly id: string;
  public readonly servicioId: string;
  public readonly codigoInspeccion: string;
  public readonly fechaEjecucion: string;
  public readonly horaInicio: string | null;
  public readonly horaFin: string | null;
  public readonly tecnicosParticipantes: Array<{ id: string; nombre: string }>;
  private snapshotCatalogos: Record<string, unknown>;
  private versionSync: number;
  private estado: EstadoInspeccion;

  constructor(props: InspeccionProps);
  constructor(id: string, servicioId: string, codigoInspeccion?: string);
  constructor(propsOrId: InspeccionProps | string, servicioId?: string, codigoInspeccion?: string) {
    if (typeof propsOrId === 'string') {
      this.id = propsOrId;
      this.servicioId = servicioId!;
      this.codigoInspeccion = codigoInspeccion || `INSP-${propsOrId.slice(0, 8)}`;
      this.fechaEjecucion = new Date().toISOString().split('T')[0];
      this.horaInicio = null;
      this.horaFin = null;
      this.tecnicosParticipantes = [];
      this.snapshotCatalogos = {};
      this.versionSync = 1;
      this.estado = 'BORRADOR';
    } else {
      const props = propsOrId;
      if (!props.servicioId) {
        throw new Error('La inspección debe estar asociada a un servicio contratado');
      }

      if (!props.codigoInspeccion || props.codigoInspeccion.trim().length === 0) {
        throw new Error('El código de inspección es obligatorio (ej. GAFER-2026-KALLPA-001)');
      }

      this.id = props.id;
      this.servicioId = props.servicioId;
      this.codigoInspeccion = props.codigoInspeccion.trim();
      this.fechaEjecucion = props.fechaEjecucion;
      this.horaInicio = props.horaInicio ?? null;
      this.horaFin = props.horaFin ?? null;
      this.tecnicosParticipantes = props.tecnicosParticipantes ?? [];
      this.snapshotCatalogos = props.snapshotCatalogos ?? {};
      this.versionSync = props.versionSync ?? 1;
      this.estado = props.estado ?? 'BORRADOR';
    }
  }

  cerrar(snapshot?: Record<string, unknown>): void {
    if (this.estado === 'CERRADO') {
      throw new Error('La inspección ya está cerrada y bloqueada contra ediciones');
    }

    if (snapshot) {
      this.snapshotCatalogos = Object.freeze({ ...snapshot });
    }

    this.estado = 'CERRADO';
    this.versionSync += 1;
  }

  getEstado(): EstadoInspeccion {
    return this.estado;
  }

  getSnapshot(): Record<string, unknown> {
    return { ...this.snapshotCatalogos };
  }

  getVersionSync(): number {
    return this.versionSync;
  }
}
