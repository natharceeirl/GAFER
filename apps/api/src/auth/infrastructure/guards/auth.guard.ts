import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../domain/ports/token.service.port';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Encabezado de autorización ausente');
    }

    const [tipo, token] = authHeader.split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de autorización inválido. Debe ser Bearer <token>');
    }

    const payload = this.tokenService.verificarToken(token);
    request.user = payload;
    return true;
  }
}
