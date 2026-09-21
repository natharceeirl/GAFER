export interface Interviniente {
  id: string;
  nombre: string;
  cargo: string;
  dni: string;
}

export interface EquipoUsado {
  id: string;
  nombre: string;
  usado: boolean;
}

export interface InsumoAplicado {
  id: string;
  producto: string;
  lote: string;
  vencimiento: string;
  registroDigesa: string;
  cantidad: string;
  concentracion: string;
  unidad: string;
  zonas: string;
}

export type MetodoAplicacion =
  | ''
  | 'NEBULIZACION'
  | 'ASPERSION'
  | 'TERMONEBULIZACION'
  | 'CEBADO'
  | 'FUMIGACION';

export interface CondicionesAmbientales {
  temperaturaC: string;
  humedadPorc: string;
  vientoKmh: string;
}

export interface FotoAdjunta {
  id: string;
}

export interface ConformidadCliente {
  firmaDataUrl: string | null;
  nombreCompleto: string;
  cargo: string;
  responsableNoDisponible: boolean;
}

export interface InspeccionBorrador {
  servicioId: string;
  identificacion: {
    clienteCodigo: string;
    proyecto: string;
    tipoServicio: string;
    fechaHora: string;
  };
  personal: Interviniente[];
  equipos: EquipoUsado[];
  insumos: InsumoAplicado[];
  metodoAplicacion: MetodoAplicacion;
  condicionesAmbientales: CondicionesAmbientales;
  diagnostico: {
    hallazgoCatalogo: string;
    textoLibre: string;
  };
  accionesCorrectivas: string[];
  observacionesTecnicas: {
    catalogo: string;
    textoLibre: string;
  };
  recomendaciones: string[];
  fotos: FotoAdjunta[];
  conformidad: ConformidadCliente;
}

export function crearBorradorVacio(servicioId: string): InspeccionBorrador {
  return {
    servicioId,
    identificacion: { clienteCodigo: '', proyecto: '', tipoServicio: '', fechaHora: '' },
    personal: [],
    equipos: [],
    insumos: [],
    metodoAplicacion: '',
    condicionesAmbientales: { temperaturaC: '', humedadPorc: '', vientoKmh: '' },
    diagnostico: { hallazgoCatalogo: '', textoLibre: '' },
    accionesCorrectivas: [],
    observacionesTecnicas: { catalogo: '', textoLibre: '' },
    recomendaciones: [],
    fotos: [],
    conformidad: { firmaDataUrl: null, nombreCompleto: '', cargo: '', responsableNoDisponible: false },
  };
}
