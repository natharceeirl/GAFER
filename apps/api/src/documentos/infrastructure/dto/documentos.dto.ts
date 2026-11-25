import { EstadoDocumentoSchema, TipoDocumentoSchema } from '@gafer/contracts';
import { z } from 'zod';
import { createZodDtoDocumentado } from '../../../shared/infrastructure/dto/zod-dto-documentado';

const MENSAJE_TIPO = 'El campo tipo es obligatorio y debe ser INFORME o REPORTE';
const MENSAJE_ESTADO = 'Estado desconocido';

const estadoLegible = z.enum(EstadoDocumentoSchema.options, { errorMap: () => ({ message: MENSAJE_ESTADO }) });

export const CrearDocumentoSchema = z.object({
  clienteId: z
    .string({ required_error: 'El campo clienteId es obligatorio', invalid_type_error: 'El campo clienteId es obligatorio' })
    .min(1, 'El campo clienteId es obligatorio')
    .uuid('El clienteId debe ser un UUID válido')
    .describe('Cliente al que pertenece el documento'),
  tipo: z
    .enum(TipoDocumentoSchema.options, { errorMap: () => ({ message: MENSAJE_TIPO }) })
    .describe('Tipo de documento: INFORME o REPORTE (la numeración es independiente por cliente y tipo)'),
  proyectoId: z.string().uuid('El proyectoId debe ser un UUID válido').optional().describe('Sede o proyecto del documento'),
});

export const TransicionarDocumentoSchema = z.object({
  nuevoEstado: estadoLegible.describe('Estado al que pasa el documento'),
  motivo: z.string().trim().max(500, 'El motivo no puede superar 500 caracteres').optional().describe('Motivo de la transición'),
});

export const ListarDocumentosQuerySchema = z.object({
  estado: estadoLegible.optional().describe('Filtra por estado; la cola de revisión es ENVIADO_A_REVISION'),
  tipo: z.enum(TipoDocumentoSchema.options, { errorMap: () => ({ message: MENSAJE_TIPO }) }).optional().describe('Filtra por tipo'),
  clienteId: z.string().uuid('El clienteId debe ser un UUID válido').optional().describe('Filtra por cliente'),
});

export class CrearDocumentoDto extends createZodDtoDocumentado(CrearDocumentoSchema, {
  clienteId: 'a1111111-1111-4111-8111-111111111111',
  tipo: 'INFORME',
  proyectoId: 'b1111111-1111-4111-8111-111111111111',
}) {}

export class TransicionarDocumentoDto extends createZodDtoDocumentado(TransicionarDocumentoSchema, {
  nuevoEstado: 'ENVIADO_A_REVISION',
  motivo: 'Documento listo para revisión',
}) {}

export class ListarDocumentosQueryDto extends createZodDtoDocumentado(ListarDocumentosQuerySchema, {
  estado: 'ENVIADO_A_REVISION',
  tipo: 'INFORME',
  clienteId: 'a1111111-1111-4111-8111-111111111111',
}) {}
