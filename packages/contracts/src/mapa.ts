import { z } from 'zod';
import { FechaSchema } from './comun';
import { ColorAuraSchema, EstacionSchema, TipoEstacionSchema } from './estacion';
import { InspeccionRegistradaSchema } from './inspeccion';

/** Spec Mapas §5.1 — capacidad del mapa de un proyecto. */
export const LIMITES_MAPA = { planosPorProyecto: 20, estacionesPorPlano: 100 } as const;

export const PuntoSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type Punto = z.infer<typeof PuntoSchema>;

/** Terreno de un plano: su contorno y si ya está cerrado. */
export const CrearPlanoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del plano es obligatorio').max(100, 'El nombre del plano no puede superar 100 caracteres'),
  puntos: z.array(PuntoSchema).max(500, 'El contorno no puede tener más de 500 puntos').default([]),
  cerrado: z.boolean().default(false),
});
export type CrearPlano = z.infer<typeof CrearPlanoSchema>;

export const PlanoSchema = z.object({
  id: z.string().uuid(),
  proyectoId: z.string().uuid(),
  nombre: z.string(),
  puntos: z.array(PuntoSchema),
  cerrado: z.boolean(),
});
export type Plano = z.infer<typeof PlanoSchema>;

/** La fecha de la inspección la pone el servidor con la de la visita. */
export const InspeccionEntradaSchema = InspeccionRegistradaSchema.omit({ fecha: true });
export type InspeccionEntrada = z.infer<typeof InspeccionEntradaSchema>;

/**
 * Lo que el técnico registra de una estación en una visita (§5.1 a §5.3).
 * - `instalada`: se instala en esta visita; no lleva inspección (el aura se evalúa desde la siguiente visita).
 * - `reubicada`: se movió; `posicion` es donde queda y el servidor guarda de dónde vino (decisión A: conserva su aura).
 * Una estación del plano que no figura en la visita se considera retirada.
 */
export const EstacionVisitaEntradaSchema = z.object({
  estacionId: z.string().uuid('El estacionId debe ser un UUID válido'),
  numero: z.number().int().min(1, 'El número de estación va de 1 a 100').max(LIMITES_MAPA.estacionesPorPlano, 'El número de estación va de 1 a 100'),
  tipoEstacion: TipoEstacionSchema,
  posicion: PuntoSchema,
  instalada: z.boolean().default(false),
  reubicada: z.boolean().default(false),
  inspeccion: InspeccionEntradaSchema.nullable().default(null),
});
export type EstacionVisitaEntrada = z.infer<typeof EstacionVisitaEntradaSchema>;

export const RegistrarVisitaMapaSchema = z.object({
  estaciones: z.array(EstacionVisitaEntradaSchema).max(LIMITES_MAPA.estacionesPorPlano, 'Un plano admite hasta 100 estaciones'),
});
export type RegistrarVisitaMapa = z.infer<typeof RegistrarVisitaMapaSchema>;

export const EstacionEnMapaSchema = z.object({
  estacion: EstacionSchema,
  posicion: PuntoSchema,
  reubicadaDesde: PuntoSchema.nullable(),
  instaladaEnVisita: z.boolean(),
  reubicaciones: z.array(FechaSchema),
  historial: z.array(InspeccionRegistradaSchema),
  consumosSeguidos: z.number().int().nonnegative(),
});
export type EstacionEnMapa = z.infer<typeof EstacionEnMapaSchema>;

export const ResumenMapaSchema = z.object({
  estaciones: z.number().int().nonnegative(),
  circulos: z.number().int().nonnegative(),
  cuadrados: z.number().int().nonnegative(),
  icono: z.record(z.number().int().nonnegative()),
  aura: z.record(z.number().int().nonnegative()),
  desde: FechaSchema,
  hasta: FechaSchema,
});
export type ResumenMapa = z.infer<typeof ResumenMapaSchema>;

export const IrradiacionSchema = z.object({
  estacionId: z.string().uuid(),
  posicion: PuntoSchema,
  colorAura: ColorAuraSchema,
  radio: z.number().positive(),
  intensidad: z.number().min(0).max(1),
});
export type Irradiacion = z.infer<typeof IrradiacionSchema>;

/** El mapa de un plano tal como se vio al cierre de una visita. */
export const MapaVisitaSchema = z.object({
  planoId: z.string().uuid(),
  visitaId: z.string().uuid(),
  fecha: FechaSchema,
  estaciones: z.array(EstacionEnMapaSchema),
  resumen: ResumenMapaSchema,
  irradiacion: z.array(IrradiacionSchema),
});
export type MapaVisita = z.infer<typeof MapaVisitaSchema>;

export const VisitaDelPlanoSchema = z.object({
  visitaId: z.string().uuid(),
  fecha: FechaSchema,
  estaciones: z.number().int().nonnegative(),
});
export type VisitaDelPlano = z.infer<typeof VisitaDelPlanoSchema>;
