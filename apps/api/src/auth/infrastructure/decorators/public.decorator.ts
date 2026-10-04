import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'esPublica';

/** Marca una ruta como accesible sin sesión. Todas las demás exigen token y `@Roles(...)` explícito. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
