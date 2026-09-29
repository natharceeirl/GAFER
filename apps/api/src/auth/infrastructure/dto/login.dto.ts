import { LoginRequestSchema } from '@gafer/contracts';
import { createZodDtoDocumentado } from '../../../shared/infrastructure/dto/zod-dto-documentado';

export class LoginDto extends createZodDtoDocumentado(LoginRequestSchema, {
  usuario: 'r.agarate',
  clave: 'Admin123!',
  cliente: 'web',
}) {}
