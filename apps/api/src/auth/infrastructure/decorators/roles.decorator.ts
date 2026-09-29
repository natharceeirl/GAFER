import { SetMetadata } from '@nestjs/common';
import { CargoPersonal } from '@gafer/contracts';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CargoPersonal[]) => SetMetadata(ROLES_KEY, roles);
