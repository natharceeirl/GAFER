import type { EstadoInspeccion } from '@gafer/contracts';

const ETIQUETAS_TIPO_SERVICIO: Record<string, string> = {
  DSF: 'Desinfección (DSF)',
  DSS: 'Desinsectación (DSS)',
  DRT: 'Desratización (DRT)',
  LRA: 'Limpieza de reservorios de agua potable (LRA)',
  LTG: 'Limpieza de trampas de grasa (LTG)',
  LTS: 'Limpieza de tanques sépticos (LTS)',
  LAM: 'Limpieza de ambientes (LAM)',
};

const ETIQUETAS_ESTADO_INSPECCION: Record<EstadoInspeccion, string> = {
  BORRADOR: 'BORRADOR',
  CERRADO: 'CERRADO',
  ENVIADO_A_REVISION: 'EN REVISIÓN',
  OBSERVADO: 'OBSERVADO',
  APROBADO: 'APROBADO',
};

export function etiquetaTipoServicio(tipo?: string | null): string {
  const limpio = tipo?.trim();
  if (!limpio) return 'No especificado';
  return ETIQUETAS_TIPO_SERVICIO[limpio] ?? limpio;
}

export function etiquetaEstadoInspeccion(estado: EstadoInspeccion): string {
  return ETIQUETAS_ESTADO_INSPECCION[estado] ?? estado;
}

export function formatearHorarioServicio(
  horaInicio?: string | null,
  horaFin?: string | null,
): string {
  if (!horaInicio && !horaFin) return 'Sin horario registrado';
  return `${horaInicio || '--:--'} - ${horaFin || '--:--'}`;
}

export interface InsumoSnapshotVista {
  nombre: string;
  dosis?: string;
  lote?: string;
  cantidad?: string;
  registroDigesa?: string;
}

export interface EquipoSnapshotVista {
  nombre: string;
  codigoInterno?: string;
  tipo?: string;
  marcaModelo?: string;
}

export interface EstacionSnapshotVista {
  etiqueta: string;
  estado?: string;
  consumoGramos?: number;
  repuestoGramos?: number;
  observaciones?: string;
}

export interface ResumenSnapshotVista {
  insumos: InsumoSnapshotVista[];
  equipos: EquipoSnapshotVista[];
  estaciones: EstacionSnapshotVista[];
  fechaCierre?: string;
}

function esObjeto(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function textoOpcional(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const limpio = val.trim();
  return limpio.length > 0 ? limpio : undefined;
}

function numeroOpcional(val: unknown): number | undefined {
  return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
}

export function extraerResumenSnapshot(
  snapshot?: Record<string, unknown>,
): ResumenSnapshotVista {
  if (!esObjeto(snapshot)) {
    return { insumos: [], equipos: [], estaciones: [] };
  }

  const rawInsumos = Array.isArray(snapshot.insumos) ? snapshot.insumos : [];
  const insumos: InsumoSnapshotVista[] = rawInsumos.filter(esObjeto).map((item) => {
    const nombre =
      textoOpcional(item.nombreHistorico) ||
      textoOpcional(item.nombreComercial) ||
      textoOpcional(item.nombre) ||
      'Insumo registrado';
    const cantNum = numeroOpcional(item.cantidadUtilizada);
    const unidad = textoOpcional(item.unidadMedida);
    const cantidad =
      cantNum !== undefined ? `${cantNum}${unidad ? ` ${unidad}` : ''}` : undefined;

    return {
      nombre,
      dosis: textoOpcional(item.dosisAplicada),
      lote: textoOpcional(item.lote),
      cantidad,
      registroDigesa: textoOpcional(item.registroDigesa),
    };
  });

  const rawEquipos = Array.isArray(snapshot.equipos) ? snapshot.equipos : [];
  const equipos: EquipoSnapshotVista[] = rawEquipos.filter(esObjeto).map((item) => ({
    nombre: textoOpcional(item.nombre) || 'Equipo registrado',
    codigoInterno: textoOpcional(item.codigoInterno),
    tipo: textoOpcional(item.tipo),
    marcaModelo: textoOpcional(item.marcaModelo),
  }));

  const rawEstaciones = Array.isArray(snapshot.estaciones)
    ? snapshot.estaciones
    : Array.isArray(snapshot.planillaEstaciones)
      ? snapshot.planillaEstaciones
      : [];
  const estaciones: EstacionSnapshotVista[] = rawEstaciones.filter(esObjeto).map((item, idx) => {
    const num = numeroOpcional(item.numero);
    const codigo = textoOpcional(item.codigo);
    const etiqueta = codigo || (num !== undefined ? `Estación #${num}` : `Estación ${idx + 1}`);
    return {
      etiqueta,
      estado: textoOpcional(item.estado),
      consumoGramos: numeroOpcional(item.consumoGramos),
      repuestoGramos: numeroOpcional(item.repuestoGramos),
      observaciones: textoOpcional(item.observaciones),
    };
  });

  const fechaCierre = textoOpcional(snapshot.fechaCierre);

  return { insumos, equipos, estaciones, fechaCierre };
}
