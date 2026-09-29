import { z } from 'zod';
import { EstadoActivoInactivoSchema } from './cliente';
import { DniSchema, FechaSchema, TelefonoSchema } from './comun';

/** Spec §7.5 — insumos químicos y biológicos. */
export const PresentacionInsumoSchema = z.enum(['LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO']);
export type PresentacionInsumo = z.infer<typeof PresentacionInsumoSchema>;

export const UnidadMedidaInsumoSchema = z.enum(['ML', 'L', 'G', 'KG', 'SOBRE', 'BLOQUE', 'UNIDAD']);
export type UnidadMedidaInsumo = z.infer<typeof UnidadMedidaInsumoSchema>;

export const InsumoSchema = z.object({
  id: z.string().uuid(),
  nombreComercial: z.string().min(1).describe('Nombre comercial'),
  principioActivo: z.string().min(1).describe('Principio activo'),
  presentacion: PresentacionInsumoSchema.describe('Presentación del producto'),
  unidadMedida: UnidadMedidaInsumoSchema.describe('Unidad de medida del stock y de los consumos'),
  registroDigesa: z.string().min(1).describe('Registro DIGESA oficial'),
  concentracion: z.string().min(1).describe('Concentración'),
  dosisEstandar: z.string().min(1).describe('Dosis estándar'),
  fichaTecnicaKey: z.string().min(1).describe('Clave de la ficha técnica en MinIO S3'),
  hojaMsdsKey: z.string().min(1).describe('Clave de la hoja MSDS en MinIO S3'),
  resolucionKey: z.string().nullish().describe('Clave de la resolución en MinIO S3'),
  proveedor: z.string().nullish().describe('Proveedor'),
  estado: EstadoActivoInactivoSchema,
});
export type Insumo = z.infer<typeof InsumoSchema>;

export const InsumoRegistroSchema = InsumoSchema.omit({ id: true, estado: true });
export type InsumoRegistro = z.infer<typeof InsumoRegistroSchema>;

/** Datos que se pueden corregir de un insumo ya registrado: cualquier subconjunto de los del alta. */
export const InsumoActualizacionSchema = InsumoRegistroSchema.partial();
export type InsumoActualizacion = z.infer<typeof InsumoActualizacionSchema>;

/** Spec §7.5 — equipos operativos; los códigos son los de la base de datos, no las etiquetas de pantalla. */
export const TipoEquipoSchema = z.enum(['FUMIGACION', 'NEBULIZACION', 'ASPERSION', 'LIMPIEZA', 'MEDICION', 'PROTECCION', 'OTRO']);
export type TipoEquipo = z.infer<typeof TipoEquipoSchema>;

export const EstadoOperativoEquipoSchema = z.enum(['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO']);
export type EstadoOperativoEquipo = z.infer<typeof EstadoOperativoEquipoSchema>;

export const EquipoSchema = z.object({
  id: z.string().uuid(),
  codigoInterno: z.string().min(1).describe('Código único interno GAFER'),
  nombre: z.string().min(1).describe('Nombre del equipo'),
  tipo: TipoEquipoSchema.describe('Tipo de equipo'),
  marcaModelo: z.string().nullish().describe('Marca y modelo'),
  estadoOperativo: EstadoOperativoEquipoSchema.describe('Estado operativo actual'),
  fechaAdquisicion: FechaSchema.nullish().describe('Fecha de adquisición (AAAA-MM-DD)'),
  ultimoMantenimiento: FechaSchema.nullish().describe('Fecha del último mantenimiento (AAAA-MM-DD)'),
  proximoMantenimiento: FechaSchema.nullish().describe('Fecha del próximo mantenimiento (AAAA-MM-DD)'),
});
export type Equipo = z.infer<typeof EquipoSchema>;

/** Un equipo nuevo parte como OPERATIVO si el alta no indica otro estado. */
export const EquipoRegistroSchema = EquipoSchema.omit({ id: true }).extend({
  estadoOperativo: EstadoOperativoEquipoSchema.optional().describe('Estado operativo inicial (OPERATIVO si no se indica)'),
});
export type EquipoRegistro = z.infer<typeof EquipoRegistroSchema>;

export const CambioEstadoEquipoSchema = z.object({
  estadoOperativo: EstadoOperativoEquipoSchema.describe('Nuevo estado operativo del equipo'),
});
export type CambioEstadoEquipo = z.infer<typeof CambioEstadoEquipoSchema>;

/** Datos que se pueden actualizar de un equipo ya registrado: cualquier subconjunto de los del alta. */
export const EquipoActualizacionSchema = EquipoRegistroSchema.partial();
export type EquipoActualizacion = z.infer<typeof EquipoActualizacionSchema>;

/** Spec §7.6 — personal técnico y de supervisión. */
export const CargoPersonalSchema = z.enum(['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR']);
export type CargoPersonal = z.infer<typeof CargoPersonalSchema>;

export const PersonalSchema = z.object({
  id: z.string().uuid(),
  dni: DniSchema.describe('DNI exacto de 8 dígitos'),
  nombres: z.string().min(1).describe('Nombres completos'),
  apellidos: z.string().min(1).describe('Apellidos completos'),
  cargo: CargoPersonalSchema.describe('Cargo del personal'),
  telefono: TelefonoSchema.describe('Teléfono celular'),
  usuario: z.string().nullish().describe('Nombre de usuario'),
  estado: EstadoActivoInactivoSchema,
});
export type Personal = z.infer<typeof PersonalSchema>;

export const PersonalRegistroSchema = PersonalSchema.omit({ id: true, estado: true });
export type PersonalRegistro = z.infer<typeof PersonalRegistroSchema>;

/** Datos que se pueden actualizar de un personal ya registrado: cualquier subconjunto de los del alta. */
export const PersonalActualizacionSchema = PersonalRegistroSchema.partial();
export type PersonalActualizacion = z.infer<typeof PersonalActualizacionSchema>;

/** Spec §7.7 — catálogos de texto editables desde el panel web. */
export const CatalogoTextoIdSchema = z.enum([
  'hallazgos',
  'acciones-correctivas',
  'observaciones',
  'recomendaciones',
  'giros',
  'motivos-modificacion',
]);
export type CatalogoTextoId = z.infer<typeof CatalogoTextoIdSchema>;

export const CatalogoTextoSchema = z.object({
  id: CatalogoTextoIdSchema,
  titulo: z.string().min(1),
  items: z.array(z.string().min(1)),
  /** "Motivos de modificación" lo edita solo el Administrador. */
  soloAdministrador: z.boolean().optional(),
});
export type CatalogoTexto = z.infer<typeof CatalogoTextoSchema>;
