/**
 * Roles del backoffice web. El Técnico Operador trabaja solo desde la app
 * Android (decisión C10, §16), por eso no es un rol de esta aplicación.
 */
export type Rol = 'ADMINISTRADOR' | 'SUPERVISOR';

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
};
