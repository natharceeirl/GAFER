import { z } from 'zod';
import { FechaSchema } from './comun';

/** Módulos sujetos a trazabilidad y registro de acciones */
export const ModuloAuditoriaSchema = z.enum([
  'MANTENIMIENTO',
  'OPERACIONES',
  'DOCUMENTOS',
  'CONFIGURACION',
  'AUTH',
  'INVENTARIO',
]);
export type ModuloAuditoria = z.infer<typeof ModuloAuditoriaSchema>;

/** Parámetros para registrar un evento en la bitácora inmutable de auditoría */
export const EventoAuditoriaRegistroSchema = z.object({
  actorId: z.string().uuid().nullable().optional().describe('ID del personal que ejecutó la acción (si aplica)'),
  actorUsuario: z.string().min(1).describe('Nombre de usuario en mayúsculas'),
  actorRol: z.string().min(1).describe('Rol del actor al momento de la acción'),
  modulo: ModuloAuditoriaSchema.describe('Módulo funcional de la acción'),
  accion: z.string().min(1).describe('Acción ejecutada (ej. CREAR_CLIENTE, ACTUALIZAR_CATALOGO)'),
  entidad: z.string().min(1).describe('Entidad o recurso afectado (ej. cliente, insumo, configuracion)'),
  entidadId: z.string().min(1).describe('Identificador de la entidad afectada'),
  payloadAnterior: z.record(z.unknown()).nullable().optional().describe('Estado previo de la entidad o campos'),
  payloadNuevo: z.record(z.unknown()).nullable().optional().describe('Nuevo estado de la entidad o campos'),
  detalles: z.record(z.unknown()).default({}).describe('Metadatos complementarios (IP, User-Agent, contexto)'),
});
export type EventoAuditoriaRegistro = z.infer<typeof EventoAuditoriaRegistroSchema>;

/** Evento persistido con identificador único y marca de tiempo */
export const EventoAuditoriaSchema = EventoAuditoriaRegistroSchema.extend({
  id: z.string().uuid().describe('ID único del evento de auditoría'),
  createdAt: z.string().datetime().describe('Timestamp ISO de registro inmutable'),
});
export type EventoAuditoria = z.infer<typeof EventoAuditoriaSchema>;

/** Filtros de consulta para la bitácora de auditoría (exclusivo Administrador - Decisión C6) */
export const ConsultaAuditoriaFiltrosSchema = z.object({
  modulo: ModuloAuditoriaSchema.optional().describe('Filtrar por módulo funcional (MANTENIMIENTO, OPERACIONES, etc.)'),
  entidad: z.string().optional().describe('Filtrar por tipo de entidad afectada (ej. cliente, insumo, configuracion)'),
  entidadId: z.string().optional().describe('Filtrar por ID de la entidad afectada'),
  actorUsuario: z.string().optional().describe('Filtrar por nombre de usuario del actor'),
  desde: FechaSchema.optional().describe('Fecha inicial de búsqueda (AAAA-MM-DD)'),
  hasta: FechaSchema.optional().describe('Fecha final de búsqueda (AAAA-MM-DD)'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Cantidad máxima de eventos por página'),
  offset: z.coerce.number().int().min(0).default(0).describe('Desplazamiento para paginación'),
});
export type ConsultaAuditoriaFiltros = z.infer<typeof ConsultaAuditoriaFiltrosSchema>;
