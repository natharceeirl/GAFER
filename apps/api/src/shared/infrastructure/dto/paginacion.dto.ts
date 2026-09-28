import { PaginacionQuerySchema } from '@gafer/contracts';
import { createZodDtoDocumentado } from './zod-dto-documentado';

export class PaginacionQueryDto extends createZodDtoDocumentado(PaginacionQuerySchema, {
  limit: 20,
  offset: 0,
  busqueda: 'KALLPA',
}) {}
