import { z } from 'zod';
import { FechaSchema, HoraSchema } from './comun';
import { PorcentajeConsumoSchema, EstadoFisicoEstacionSchema } from './inspeccion';

/**
 * GAFER — Contrato Acta de Servicio DRT (Desratización / Control de Roedores)
 * Siguiendo el acta oficial en papel entregada por GAFER (GAF-103) y registro por estación (§5.1, GAF-35).
 */

export const ActividadDrtSchema = z.enum([
  'EVALUACION',
  'INSTALACION',
  'MONITOREO',
  'EMERGENCIA',
]);
export type ActividadDrt = z.infer<typeof ActividadDrtSchema>;

export const TipoCeboDrtSchema = z.enum([
  'BLOQUE_5G',
  'BLOQUE_10G',
  'PELLETS',
  'PASTA',
  'LIQUIDO',
  'NINGUNO',
]);
export type TipoCeboDrt = z.infer<typeof TipoCeboDrtSchema>;

export const TipoTrampaDrtSchema = z.enum([
  'MECANICA',
  'PEGATINA',
  'JAULA',
  'NINGUNA',
]);
export type TipoTrampaDrt = z.infer<typeof TipoTrampaDrtSchema>;

export const EspecieRoedorDrtSchema = z.enum([
  'R_RATTUS', // Rata negra / del tejado
  'R_NORVEGICUS', // Rata de alcantarilla / parda
  'MUS_MUSCULUS', // Ratón casero
]);
export type EspecieRoedorDrt = z.infer<typeof EspecieRoedorDrtSchema>;

export const EstadoEstacionPlanillaSchema = z.enum([
  'SIN_ACTIVIDAD', // Intacta
  'CON_CONSUMO', // Cebo consumido o trampa con captura
  'SIN_ACCESO', // Obstruida, cerrada con candado o inaccesible (pedido por GAFER)
  'EXTRAVIADA', // Punto desaparecido o destruido (pedido por GAFER)
]);
export type EstadoEstacionPlanilla = z.infer<typeof EstadoEstacionPlanillaSchema>;

/**
 * Registro de estación individual (§5.1, GAF-35).
 * - En primera visita (instalación): registra cebo, gramos, lote, vencimiento y estado físico sin evaluar consumo.
 * - En visitas regulares: evalúa consumo Sí/No con porcentaje en pasos de 25, gramos consumidos y reposición.
 */
export const ItemEstacionPlanillaSchema = z.object({
  numero: z.number().int().positive(),
  estado: EstadoEstacionPlanillaSchema,
  consumoGramos: z.number().nonnegative().optional(),
  repuestoGramos: z.number().nonnegative().optional(),
  observaciones: z.string().optional(),
  // Campos por estación §5.1 / GAF-35:
  tipoCebo: z.string().optional(),
  cantidadGramos: z.number().nonnegative().optional(),
  lote: z.string().optional(),
  vencimiento: FechaSchema.optional(),
  huboConsumo: z.boolean().optional(),
  porcentajeConsumo: PorcentajeConsumoSchema.optional(),
  estadoFisico: EstadoFisicoEstacionSchema.optional(),
  cantidadReposicion: z.number().nonnegative().optional(),
  esInstalacion: z.boolean().optional(),
});
export type ItemEstacionPlanilla = z.infer<typeof ItemEstacionPlanillaSchema>;

export const FirmaConformidadDrtSchema = z.object({
  personalResponsableNombre: z.string().min(1, 'El nombre del responsable es requerido'),
  personalResponsableCargo: z.string().min(1, 'El cargo del responsable es requerido'),
  clienteConformidadNombre: z.string().min(1, 'El nombre del contacto del cliente es requerido'),
  clienteConformidadCargo: z.string().min(1, 'El cargo del contacto del cliente es requerido'),
  fecha: FechaSchema,
  firmaDigitalBase64: z.string().optional(),
});
export type FirmaConformidadDrt = z.infer<typeof FirmaConformidadDrtSchema>;

export const ActaServicioDrtSchema = z.object({
  // 1. Datos Generales
  servicioId: z.string().uuid(),
  clienteRazonSocial: z.string().min(1),
  sedeDireccion: z.string().min(1),
  fecha: FechaSchema,
  areaTratadaM2: z.number().nonnegative().nullish(),
  horaInicio: HoraSchema,
  horaTermino: HoraSchema,
  primeraVisita: z.boolean().optional(),

  // 2. Actividad
  actividad: ActividadDrtSchema,

  // 3. Cebos Químicos
  tipoCebo: TipoCeboDrtSchema,
  cebosInstalados: z.number().int().nonnegative().default(0),
  cebosConsumidos: z.number().int().nonnegative().default(0),
  cebosRepuestos: z.number().int().nonnegative().default(0),

  // 4. Trampas Físicas
  tipoTrampa: TipoTrampaDrtSchema,
  trampasInstaladas: z.number().int().nonnegative().default(0),
  trampasActivadas: z.number().int().nonnegative().default(0),

  // 5. Especies de Roedores
  roedoresDetectados: z.array(EspecieRoedorDrtSchema).default([]),

  // 6. Diagnóstico y Observaciones
  resultadosRecomendaciones: z.string().default(''),
  observacionesCliente: z.string().default(''),

  // 7. Firmas y Conformidad
  firmas: FirmaConformidadDrtSchema,

  // 8. Planilla de Estaciones de Control
  planillaEstaciones: z.array(ItemEstacionPlanillaSchema).default([]),
});
export type ActaServicioDrt = z.infer<typeof ActaServicioDrtSchema>;
