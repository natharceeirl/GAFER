import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CargoPersonal } from '@gafer/contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TokenPayload } from '../../domain/ports/token.service.port';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<CargoPersonal[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
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
