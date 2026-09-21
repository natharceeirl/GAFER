/**
 * Catálogos de ejemplo — en producción vienen del módulo Mantenimiento
 * (no construido todavía en este pase). Datos ilustrativos, nunca
 * reales, siguiendo los ejemplos del propio documento de especificación.
 */

export const CLIENTES_MOCK = [
  { codigo: 'KALLPA', proyecto: 'CSF_SUNNY' },
  { codigo: 'SAMAY', proyecto: 'PLANTA_NORTE' },
  { codigo: 'PETROPERU', proyecto: 'ALMACEN_CENTRAL' },
];

export const TIPOS_SERVICIO = ['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM'] as const;

export const EQUIPOS_CATALOGO_MOCK = [
  'Nebulizadora ULV Vector Fog C-150',
  'Bomba de aspersión manual 16L',
  'Termonebulizadora a gasolina',
  'Estación de cebado sellada',
];

export const METODOS_APLICACION = [
  { value: 'NEBULIZACION', label: 'Nebulización' },
  { value: 'ASPERSION', label: 'Aspersión' },
  { value: 'TERMONEBULIZACION', label: 'Termonebulización' },
  { value: 'CEBADO', label: 'Cebado' },
  { value: 'FUMIGACION', label: 'Fumigación' },
] as const;

export const HALLAZGOS_CATALOGO_MOCK = [
  'Sin actividad detectada',
  'Presencia de roedores — zona húmeda',
  'Presencia de insectos rastreros',
  'Condición sanitaria deficiente en zona circundante',
];

export const ACCIONES_CORRECTIVAS_MOCK = [
  'Aplicación de rodenticida en estaciones activas',
  'Sellado de puntos de ingreso',
  'Retiro de residuos acumulados',
  'Refuerzo de cebaderos en zona crítica',
];

export const OBSERVACIONES_CATALOGO_MOCK = [
  'Acceso restringido en zona de almacén',
  'Cliente solicita reprogramación de horario',
  'Condiciones especiales de EPP requeridas',
];

export const RECOMENDACIONES_CATALOGO_MOCK = [
  'Mantener puertas cerradas en horario nocturno',
  'Evitar acumulación de residuos orgánicos',
  'Reportar hallazgos entre visitas',
];
