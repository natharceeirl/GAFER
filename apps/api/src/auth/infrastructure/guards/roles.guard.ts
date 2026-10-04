import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CargoPersonal } from '@gafer/contracts';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TokenPayload } from '../../domain/ports/token.service.port';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const destinos = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, destinos)) {
      return true;
    }

    // Denegar por defecto: una ruta que no es pública y no declara @Roles(...) nunca se atiende.
    const rolesRequeridos = this.reflector.getAllAndOverride<CargoPersonal[]>(ROLES_KEY, destinos);
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      throw new ForbiddenException('Ruta sin roles declarados: acceso denegado por defecto');
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as TokenPayload;

    if (!user || !user.cargo) {
      throw new ForbiddenException('Usuario no autenticado o sin rol asignado');
    }

    const tieneRolPermitido = rolesRequeridos.includes(user.cargo);
    if (!tieneRolPermitido) {
      throw new ForbiddenException(
        `Acceso denegado: el rol ${user.cargo} no tiene permisos para esta acción`,
      );
    }

    return true;
  }
}
