export type Rol = 'ADMINISTRADOR' | 'SUPERVISOR' | 'TECNICO_OPERARIO';

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
  TECNICO_OPERARIO: 'Técnico Operario',
};

/**
 * Funciones por rol según la tabla de la sección 12 del PDF de
 * especificaciones (Mantenimiento / Operaciones / Aprobación /
 * Modifica post-aprobación), más §3 (visibilidad del técnico) y §10.1
 * (dashboard exclusivo de Administrador y Supervisor).
 */
export const ROLES_MOCK: RolInfo[] = [
  {
    id: 'ADMINISTRADOR',
    nombre: NOMBRE_ROL.ADMINISTRADOR,
    usuarioSugerido: 'r.rojas',
    resumen: 'Acceso completo al sistema',
    funciones: [
      'Crea clientes, proyectos, servicios, insumos, equipos, personal y catálogos',
      'Registra y cierra inspecciones de cualquier proyecto',
      'Aprueba y envía documentos al cliente',
      'Modifica datos post-aprobación, con registro obligatorio',
    ],
  },
  {
    id: 'SUPERVISOR',
    nombre: NOMBRE_ROL.SUPERVISOR,
    usuarioSugerido: 'd.amamani',
    resumen: 'Operación y aprobación, sin alta de clientes ni proyectos',
    funciones: [
      'Edita solo catálogos de texto (observaciones, recomendaciones)',
      'Registra y cierra inspecciones; puede modificar post-cierre con su clave',
      'Aprueba y envía documentos al cliente',
    ],
  },
  {
    id: 'TECNICO_OPERARIO',
    nombre: NOMBRE_ROL.TECNICO_OPERARIO,
    usuarioSugerido: 'm.ipusari',
    resumen: 'Trabajo de campo, sin Mantenimiento ni aprobación',
    funciones: [
      'Ve todos los proyectos activos del sistema, sin restricción por asignación',
      'Registra y cierra inspecciones de cualquier proyecto activo',
      'Sin acceso a Mantenimiento ni a la bandeja de aprobación',
    ],
  },
];
