import { Generated, ColumnType } from 'kysely';

import type {
  CargoPersonal,
  EstadoActivoInactivo,
  EstadoInspeccion,
  EstadoOperativoEquipo,
  FrecuenciaServicio,
  PresentacionInsumo,
  TipoEquipo,
  TipoServicio,
  UnidadMedidaInsumo,
} from '@gafer/contracts';

export type {
  CargoPersonal,
  EstadoInspeccion,
  EstadoOperativoEquipo,
  FrecuenciaServicio,
  PresentacionInsumo,
  TipoEquipo,
  TipoServicio,
  UnidadMedidaInsumo,
};
export type EstadoGeneral = EstadoActivoInactivo;

export interface ClientesTable {
  id: Generated<string>;
  razon_social: string;
  ruc: string;
  codigo_corto: string;
  direccion_fiscal: string;
  giro_negocio: string;
  contacto_nombre: string;
  contacto_cargo: string;
  contacto_telefono: string;
  contacto_correo: string;
  estado: Generated<EstadoGeneral>;
  campos_extra: ColumnType<Record<string, unknown>, string, string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ProyectosTable {
  id: Generated<string>;
  cliente_id: string;
  nombre: string;
  direccion_sede: string;
  distrito: string;
  provincia: string;
  departamento: string;
  contacto_nombre: string;
  contacto_cargo: string;
  contacto_telefono: string;
  estado: Generated<EstadoGeneral>;
  observaciones: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ServiciosContratadosTable {
  id: Generated<string>;
  proyecto_id: string;
  tipo_servicio: TipoServicio;
  frecuencia: FrecuenciaServicio;
  area_total_m2: ColumnType<number, string | number, string | number>;
  area_tratar_m2: ColumnType<number, string | number, string | number>;
  insumos_autorizados: ColumnType<string[], string, string>;
  equipos_autorizados: ColumnType<string[], string, string>;
  dosis_referencial: ColumnType<Record<string, string>, string, string>;
  requiere_certificado: Generated<boolean>;
  vigencia_dias: number | null;
  estado: Generated<EstadoGeneral>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface InsumosTable {
  id: Generated<string>;
  nombre_comercial: string;
  principio_activo: string;
  presentacion: PresentacionInsumo;
  unidad_medida: UnidadMedidaInsumo;
  registro_digesa: string;
  concentracion: string;
  dosis_estandar: string;
  ficha_tecnica_key: string;
  hoja_msds_key: string;
  resolucion_key: string | null;
  proveedor: string | null;
  estado: Generated<EstadoGeneral>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface EquiposTable {
  id: Generated<string>;
  codigo_interno: string;
  nombre: string;
  tipo: TipoEquipo;
  marca_modelo: string | null;
  estado_operativo: Generated<EstadoOperativoEquipo>;
  fecha_adquisicion: string | null;
  ultimo_mantenimiento: string | null;
  proximo_mantenimiento: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PersonalTable {
  id: Generated<string>;
  dni: string;
  nombres: string;
  apellidos: string;
  cargo: CargoPersonal;
  telefono: string;
  usuario: string | null;
  estado: Generated<EstadoGeneral>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface InspeccionesTable {
  id: Generated<string>;
  servicio_id: string;
  codigo_inspeccion: string;
  estado: Generated<EstadoInspeccion>;
  version_sync: Generated<number>;
  fecha_ejecucion: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  tecnicos_participantes: ColumnType<Array<{ id: string; nombre: string }>, string, string>;
  snapshot_catalogos: ColumnType<Record<string, unknown>, string, string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface InspeccionesAuditoriaTable {
  id: Generated<string>;
  inspeccion_id: string;
  actor_id: string;
  accion: string;
  payload_anterior: ColumnType<Record<string, unknown> | null, string | null, string | null>;
  payload_nuevo: ColumnType<Record<string, unknown> | null, string | null, string | null>;
  server_received_at: Generated<Date>;
}

export interface CatalogosTextoTable {
  id: string;
  titulo: string;
  items: ColumnType<string[], string, string>;
  solo_administrador: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ConfiguracionSistemaTable {
  id: Generated<string>;
  director_nombre: Generated<string>;
  director_cip: Generated<string>;
  director_firma: string | null;
  resolucion_sanitaria: Generated<string>;
  parametros: ColumnType<Record<string, unknown>, string, string>;
  actualizado_por: string | null;
  updated_at: Generated<Date>;
}

export interface AuditoriaEventosTable {
  id: Generated<string>;
  actor_id: string | null;
  actor_usuario: string;
  actor_rol: string;
  modulo: string;
  accion: string;
  entidad: string;
  entidad_id: string;
  payload_anterior: ColumnType<Record<string, unknown> | null, string | null, string | null>;
  payload_nuevo: ColumnType<Record<string, unknown> | null, string | null, string | null>;
  detalles: ColumnType<Record<string, unknown>, string, string>;
  created_at: Generated<Date>;
}

export interface GaferDatabase {
  clientes: ClientesTable;
  proyectos: ProyectosTable;
  servicios_contratados: ServiciosContratadosTable;
  insumos: InsumosTable;
  equipos: EquiposTable;
  personal: PersonalTable;
  inspecciones: InspeccionesTable;
  inspecciones_auditoria: InspeccionesAuditoriaTable;
  catalogos_texto: CatalogosTextoTable;
  configuracion_sistema: ConfiguracionSistemaTable;
  auditoria_eventos: AuditoriaEventosTable;
}
