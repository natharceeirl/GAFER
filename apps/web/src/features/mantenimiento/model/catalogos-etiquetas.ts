import type {
  CargoPersonal,
  EstadoActivoInactivo,
  EstadoOperativoEquipo,
  PresentacionInsumo,
  TipoEquipo,
  UnidadMedidaInsumo,
} from '@gafer/contracts';

/**
 * Único módulo donde los códigos de la base de datos (los de `@gafer/contracts`) se convierten en la etiqueta
 * que ve la persona usuaria: estado operativo y tipo de equipo, presentación y unidad de los insumos, y estado
 * activo. El dominio y los formularios trabajan con códigos; solo al dibujar el texto pasan por aquí.
 */

interface Entrada<C extends string> {
  codigo: C;
  etiqueta: string;
}

/** El código de la base es `FUERA_SERVICIO`; la pantalla dice "Fuera de servicio". */
export const ESTADOS_OPERATIVOS: Array<Entrada<EstadoOperativoEquipo>> = [
  { codigo: 'OPERATIVO', etiqueta: 'Operativo' },
  { codigo: 'MANTENIMIENTO', etiqueta: 'En mantenimiento' },
  { codigo: 'FUERA_SERVICIO', etiqueta: 'Fuera de servicio' },
];

export const TIPOS_EQUIPO: Array<Entrada<TipoEquipo>> = [
  { codigo: 'FUMIGACION', etiqueta: 'Fumigación' },
  { codigo: 'NEBULIZACION', etiqueta: 'Nebulización' },
  { codigo: 'ASPERSION', etiqueta: 'Aspersión' },
  { codigo: 'LIMPIEZA', etiqueta: 'Limpieza' },
  { codigo: 'MEDICION', etiqueta: 'Medición' },
  { codigo: 'PROTECCION', etiqueta: 'Protección' },
  { codigo: 'OTRO', etiqueta: 'Otro' },
];

export const PRESENTACIONES: Array<Entrada<PresentacionInsumo>> = [
  { codigo: 'LIQUIDO', etiqueta: 'Líquido' },
  { codigo: 'POLVO', etiqueta: 'Polvo' },
  { codigo: 'BLOQUE', etiqueta: 'Bloque' },
  { codigo: 'SOBRE', etiqueta: 'Sobre' },
  { codigo: 'GEL', etiqueta: 'Gel' },
  { codigo: 'OTRO', etiqueta: 'Otro' },
];

export const UNIDADES_MEDIDA: Array<Entrada<UnidadMedidaInsumo>> = [
  { codigo: 'ML', etiqueta: 'Mililitros (ml)' },
  { codigo: 'L', etiqueta: 'Litros (L)' },
  { codigo: 'G', etiqueta: 'Gramos (g)' },
  { codigo: 'KG', etiqueta: 'Kilogramos (kg)' },
  { codigo: 'SOBRE', etiqueta: 'Sobres' },
  { codigo: 'BLOQUE', etiqueta: 'Bloques' },
  { codigo: 'UNIDAD', etiqueta: 'Unidades' },
];

/** Cargo del personal (§7.6); el código de la base es `TECNICO_OPERADOR`. */
export const CARGOS_PERSONAL: Array<Entrada<CargoPersonal>> = [
  { codigo: 'ADMINISTRADOR', etiqueta: 'Administrador' },
  { codigo: 'SUPERVISOR', etiqueta: 'Supervisor' },
  { codigo: 'TECNICO_OPERADOR', etiqueta: 'Técnico Operador' },
];

const ESTADOS_ACTIVOS: Array<Entrada<EstadoActivoInactivo>> = [
  { codigo: 'ACTIVO', etiqueta: 'Activo' },
  { codigo: 'INACTIVO', etiqueta: 'Inactivo' },
];

/** Etiqueta de un código; si el API entrega uno que la pantalla no conoce, se muestra tal cual. */
function etiquetaDe<C extends string>(lista: Array<Entrada<C>>, codigo: C): string {
  return lista.find((e) => e.codigo === codigo)?.etiqueta ?? codigo;
}

export const etiquetaEstadoOperativo = (codigo: EstadoOperativoEquipo) => etiquetaDe(ESTADOS_OPERATIVOS, codigo);
export const etiquetaTipoEquipo = (codigo: TipoEquipo) => etiquetaDe(TIPOS_EQUIPO, codigo);
export const etiquetaPresentacion = (codigo: PresentacionInsumo) => etiquetaDe(PRESENTACIONES, codigo);
export const etiquetaUnidad = (codigo: UnidadMedidaInsumo) => etiquetaDe(UNIDADES_MEDIDA, codigo);
export const etiquetaEstadoActivo = (codigo: EstadoActivoInactivo) => etiquetaDe(ESTADOS_ACTIVOS, codigo);
export const etiquetaCargo = (codigo: CargoPersonal) => etiquetaDe(CARGOS_PERSONAL, codigo);
