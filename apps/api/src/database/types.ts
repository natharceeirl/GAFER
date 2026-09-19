import { Generated, ColumnType } from 'kysely';

export type EstadoGeneral = 'ACTIVO' | 'INACTIVO';
export type TipoServicio = 'DSF' | 'DSS' | 'DRT' | 'LRA' | 'LTG' | 'LTS' | 'LAM';
export type FrecuenciaServicio =
  | 'DIARIA'
  | 'SEMANAL'
  | 'QUINCENAL'
  | 'MENSUAL'
  | 'BIMESTRAL'
  | 'TRIMESTRAL'
  | 'SEMESTRAL'
  | 'ANUAL'
  | 'PUNTUAL';

export type PresentacionInsumo = 'LIQUIDO' | 'POLVO' | 'BLOQUE' | 'SOBRE' | 'GEL' | 'OTRO';
export type UnidadMedidaInsumo = 'ML' | 'L' | 'G' | 'KG' | 'SOBRE' | 'BLOQUE' | 'UNIDAD';

export type TipoEquipo =
  | 'FUMIGACION'
  | 'NEBULIZACION'
  | 'ASPERSION'
  | 'LIMPIEZA'
  | 'MEDICION'
  | 'PROTECCION'
  | 'OTRO';

export type EstadoOperativoEquipo = 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO';
export type CargoPersonal = 'SUPERVISOR' | 'TECNICO_OPERADOR';

export type EstadoInspeccion =
  | 'BORRADOR'
  | 'CERRADO'
  | 'ENVIADO_A_REVISION'
  | 'OBSERVADO'
  | 'APROBADO';

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

export interface GaferDatabase {
  clientes: ClientesTable;
  proyectos: ProyectosTable;
  servicios_contratados: ServiciosContratadosTable;
  insumos: InsumosTable;
  equipos: EquiposTable;
  personal: PersonalTable;
  inspecciones: InspeccionesTable;
  inspecciones_auditoria: InspeccionesAuditoriaTable;
}
