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
  nombreComercial: z.string().min(1),
  principioActivo: z.string().min(1),
  presentacion: PresentacionInsumoSchema,
  unidadMedida: UnidadMedidaInsumoSchema,
  registroDigesa: z.string().min(1),
  concentracion: z.string().min(1),
  dosisEstandar: z.string().min(1),
  fichaTecnicaKey: z.string().min(1),
  hojaMsdsKey: z.string().min(1),
  resolucionKey: z.string().nullish(),
  proveedor: z.string().nullish(),
  estado: EstadoActivoInactivoSchema,
});
export type Insumo = z.infer<typeof InsumoSchema>;

export const InsumoRegistroSchema = InsumoSchema.omit({ id: true, estado: true });
export type InsumoRegistro = z.infer<typeof InsumoRegistroSchema>;

/** Spec §7.5 — equipos operativos; los códigos son los de la base de datos, no las etiquetas de pantalla. */
export const TipoEquipoSchema = z.enum(['FUMIGACION', 'NEBULIZACION', 'ASPERSION', 'LIMPIEZA', 'MEDICION', 'PROTECCION', 'OTRO']);
export type TipoEquipo = z.infer<typeof TipoEquipoSchema>;

export const EstadoOperativoEquipoSchema = z.enum(['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO']);
export type EstadoOperativoEquipo = z.infer<typeof EstadoOperativoEquipoSchema>;

export const EquipoSchema = z.object({
  id: z.string().uuid(),
  codigoInterno: z.string().min(1),
  nombre: z.string().min(1),
  tipo: TipoEquipoSchema,
  marcaModelo: z.string().nullish(),
  estadoOperativo: EstadoOperativoEquipoSchema,
  fechaAdquisicion: FechaSchema.nullish(),
  ultimoMantenimiento: FechaSchema.nullish(),
  proximoMantenimiento: FechaSchema.nullish(),
});
export type Equipo = z.infer<typeof EquipoSchema>;

export const EquipoRegistroSchema = EquipoSchema.omit({ id: true });
export type EquipoRegistro = z.infer<typeof EquipoRegistroSchema>;

/** Spec §7.6 — personal técnico y de supervisión. */
export const CargoPersonalSchema = z.enum(['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR']);
export type CargoPersonal = z.infer<typeof CargoPersonalSchema>;

export const PersonalSchema = z.object({
  id: z.string().uuid(),
  dni: DniSchema,
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  cargo: CargoPersonalSchema,
  telefono: TelefonoSchema,
  usuario: z.string().nullish(),
  estado: EstadoActivoInactivoSchema,
});
export type Personal = z.infer<typeof PersonalSchema>;

export const PersonalRegistroSchema = PersonalSchema.omit({ id: true, estado: true });
export type PersonalRegistro = z.infer<typeof PersonalRegistroSchema>;

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
