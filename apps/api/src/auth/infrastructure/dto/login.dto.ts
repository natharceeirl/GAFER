import { LoginRequestSchema } from '@gafer/contracts';
import { createZodDtoDocumentado } from '../../../shared/infrastructure/dto/zod-dto-documentado';

export class LoginDto extends createZodDtoDocumentado(LoginRequestSchema, {
  usuario: 'usuario.ejemplo',
  clave: '<clave-del-usuario>',
  cliente: 'web',
}) {}
