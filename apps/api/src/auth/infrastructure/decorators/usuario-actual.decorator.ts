import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TokenPayload } from '../../domain/ports/token.service.port';

export const UsuarioActual = createParamDecorator(
  (data: keyof TokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as TokenPayload;

    return data ? user?.[data] : user;
  },
);
