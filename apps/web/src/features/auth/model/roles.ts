/**
 * Roles del backoffice web. El Técnico Operador trabaja solo desde la app
 * Android (decisión C10, §16), por eso no es un rol de esta aplicación.
 */
export type Rol = 'ADMINISTRADOR' | 'SUPERVISOR';

export interface RolInfo {
  id: Rol;
  nombre: string;
  usuarioSugerido: string;
  resumen: string;
  funciones: string[];
}

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
};

/** Funciones por rol según la tabla de §12, resuelta con las decisiones C1 a C15. */
export const ROLES_MOCK: RolInfo[] = [
  {
    id: 'ADMINISTRADOR',
    nombre: NOMBRE_ROL.ADMINISTRADOR,
    usuarioSugerido: 'r.agarate',
    resumen: 'Acceso completo al backoffice',
    funciones: [
      'Da de alta clientes, sedes y servicios, y configura todo Mantenimiento',
      'Programa visitas y aprueba u observa documentos',
      'Es el único que modifica documentos aprobados, con motivo registrado',
      'Registra compras y entradas de inventario',
      'Consulta la bitácora de auditoría',
    ],
  },
  {
    id: 'SUPERVISOR',
    nombre: NOMBRE_ROL.SUPERVISOR,
    usuarioSugerido: 'd.amamani',
    resumen: 'Programación y aprobación, sin alta de clientes',
    funciones: [
      'Edita solo los catálogos de texto',
      'Programa visitas y aprueba u observa documentos',
      'Interviene inspecciones cerradas con su clave',
      'Consulta el inventario y recibe las alertas de stock bajo',
    ],
  },
];
