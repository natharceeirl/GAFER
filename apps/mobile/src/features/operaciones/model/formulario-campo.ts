/**
 * GAFER Mobile — Modelo y Lógica de Negocio del Formulario de Campo por Bloques (§4, §8.2, §8.3)
 * Reutiliza las reglas contractuales probadas en el prototipo web.
 */

import type { CerrarInspeccion, ConsumoInsumo, TipoDocumento, TipoServicio } from '@gafer/contracts';

export type EstadoFormulario = 'BORRADOR' | 'ENVIADO_A_REVISION' | 'CERRADO';

export interface InsumoAplicado {
  insumoId: string;
  nombreComercial?: string;
  principioActivo?: string;
  dosisReferencial?: string;
  dosisReal?: string;
  aplicado: boolean;
  lote: string;
  vencimiento: string;
  cantidad: string;
  unidad: string;
  zonas: string;
}

export interface FotoCampo {
  id: string;
  nombre: string;
  url: string;
}

export interface EventoFormulario {
  usuario: string;
  fechaHora: string;
  accion: 'Guardado parcial' | 'Cierre de inspección' | 'Enviado a revisión';
}

export interface FormularioCampo {
  id: string;
  clienteId?: string;
  clienteCodigo?: string;
  clienteRazon: string;
  proyectoId?: string;
  proyectoNombre: string;
  servicioId: string;
  servicioEtiqueta: string;
  tipoServicio: TipoServicio;
  requiereCertificado: boolean;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  personal: string[];
  equipos: string[]; // IDs de equipos utilizados
  insumos: InsumoAplicado[]; // Insumos autorizados con dosis y datos aplicados
  metodos: string[]; // Métodos de aplicación seleccionados
  temperatura: string;
  humedad: string;
  viento: string;
  estadoGeneral: string;
  nivelInfestacion: string;
  hallazgos: string[];
  hallazgosDetalle: string;
  acciones: string[];
  observaciones: string[];
  observacionesLibre: string;
  recomendaciones: string[];
  fotos: FotoCampo[];
  firma: string | null;
  firmanteNombre: string;
  firmanteCargo: string;
  responsableNoDisponible: boolean;
  certificadoNumero?: string;
  certificadoEmision?: string;
  certificadoVencimiento?: string;
  estado: EstadoFormulario;
  guardados: EventoFormulario[];
}

export const METODOS_APLICACION = [
  'Aspersión',
  'Nebulización',
  'Termonebulización',
  'Cebado',
  'Fumigación',
  'Gel',
  'Espolvoreo',
];

export const ESTADOS_GENERALES = ['Bueno', 'Regular', 'Deficiente'];
export const NIVELES_INFESTACION = ['Nulo', 'Bajo', 'Moderado', 'Alto'];
export const UNIDADES = ['g', 'kg', 'ml', 'L', 'unidad', 'sobre', 'bloque'];

export type BloqueCierre =
  | 'personal'
  | 'equipos'
  | 'insumos'
  | 'metodos'
  | 'condiciones'
  | 'diagnostico'
  | 'conformidad'
  | 'certificado';

export const NOMBRE_BLOQUE: Record<BloqueCierre, string> = {
  personal: 'Personal que intervino',
  equipos: 'Herramientas y equipos',
  insumos: 'Insumos aplicados',
  metodos: 'Método de aplicación',
  condiciones: 'Condiciones ambientales',
  diagnostico: 'Diagnóstico y hallazgos',
  conformidad: 'Conformidad del cliente',
  certificado: 'Certificado de saneamiento',
};

export interface InsumoCatalogoItem {
  id: string;
  nombreComercial: string;
  principioActivo?: string;
  dosisReferencial?: string;
  unidadMedida?: string;
}

export interface EquipoCatalogoItem {
  id: string;
  nombre: string;
  codigoInterno: string;
  tipo?: string;
}

export interface CatalogoCampoOpciones {
  hallazgos: string[];
  acciones: string[];
  observaciones: string[];
  recomendaciones: string[];
}

export const CATALOGOS_CAMPO_DEFECTO: CatalogoCampoOpciones = {
  hallazgos: [
    'Actividad de roedores en área perimetral',
    'Presencia de insectos rastreros en trastienda',
    'Excretas frescas en zócalos',
    'Fisuras o hendiduras en paredes',
    'Residuos orgánicos acumulados',
    'Sin incidencias / Inspección conforme',
  ],
  acciones: [
    'Sellado preventivo de accesos',
    'Reubicación de puntos de control',
    'Refuerzo de cebado perimetral',
    'Aplicación focalizada de gel',
    'Desinfección profunda de superficies',
  ],
  observaciones: [
    'Acceso normal a todas las zonas asignadas',
    'Humedad moderada en el área de lavado',
    'Ventilación adecuada durante la aplicación',
  ],
  recomendaciones: [
    'Mantener despejada la franja de 30 cm de los zócalos',
    'Evitar almacenamiento directo en el suelo',
    'Reparar cierres automáticos de puertas',
    'Realizar limpieza previa a la próxima visita programada',
  ],
};

export const INSUMOS_CATALOGO_SEMILLA: InsumoCatalogoItem[] = [
  {
    id: 'i1111111-0001-4000-8000-000000000001',
    nombreComercial: 'DemoCiper 25 EC',
    principioActivo: 'Cipermetrina',
    dosisReferencial: '10 ml por litro de agua',
    unidadMedida: 'L',
  },
  {
    id: 'i1111111-0002-4000-8000-000000000002',
    nombreComercial: 'DemoRaticida Bloque B',
    principioActivo: 'Brodifacoum',
    dosisReferencial: '1 bloque (20 g) por estación',
    unidadMedida: 'BLOQUE',
  },
  {
    id: 'i1111111-0003-4000-8000-000000000003',
    nombreComercial: 'DemoRaticida Bloque M',
    principioActivo: 'Bromadiolona',
    dosisReferencial: '1 bloque (20 g) por estación',
    unidadMedida: 'BLOQUE',
  },
  {
    id: 'i1111111-0004-4000-8000-000000000004',
    nombreComercial: 'DemoDelta PM 5',
    principioActivo: 'Deltametrina',
    dosisReferencial: '2 g por litro de agua',
    unidadMedida: 'KG',
  },
  {
    id: 'i1111111-0005-4000-8000-000000000005',
    nombreComercial: 'DemoGel Cucaracha',
    principioActivo: 'Imidacloprid',
    dosisReferencial: '1 g por punto de aplicación',
    unidadMedida: 'G',
  },
  {
    id: 'i1111111-0006-4000-8000-000000000006',
    nombreComercial: 'DemoCloro 5',
    principioActivo: 'Hipoclorito de sodio',
    dosisReferencial: '5 ml por litro de agua',
    unidadMedida: 'L',
  },
  {
    id: 'i1111111-0007-4000-8000-000000000007',
    nombreComercial: 'DemoQuat 10',
    principioActivo: 'Cloruro de didecildimetilamonio',
    dosisReferencial: '5 ml por litro de agua',
    unidadMedida: 'L',
  },
];

export const EQUIPOS_CATALOGO_SEMILLA: EquipoCatalogoItem[] = [
  {
    id: 'e1111111-0001-4000-8000-000000000001',
    codigoInterno: 'EQ-DEMO-001',
    nombre: 'Motomochila fumigadora 20 L',
    tipo: 'FUMIGACION',
  },
  {
    id: 'e1111111-0002-4000-8000-000000000002',
    codigoInterno: 'EQ-DEMO-002',
    nombre: 'Nebulizador ULV portátil',
    tipo: 'NEBULIZACION',
  },
  {
    id: 'e1111111-0003-4000-8000-000000000003',
    codigoInterno: 'EQ-DEMO-003',
    nombre: 'Aspersora manual 10 L',
    tipo: 'ASPERSION',
  },
  {
    id: 'e1111111-0004-4000-8000-000000000004',
    codigoInterno: 'EQ-DEMO-004',
    nombre: 'Aspersora manual 20 L',
    tipo: 'ASPERSION',
  },
  {
    id: 'e1111111-0008-4000-8000-000000000008',
    codigoInterno: 'EQ-DEMO-008',
    nombre: 'Termohigrómetro digital',
    tipo: 'MEDICION',
  },
  {
    id: 'e1111111-0010-4000-8000-000000000010',
    codigoInterno: 'EQ-DEMO-010',
    nombre: 'Kit de protección personal (EPP completo)',
    tipo: 'PROTECCION',
  },
];

export interface InsumoServicioConfig {
  insumoId: string;
  nombreComercial?: string;
  principioActivo?: string;
  dosisReferencial?: string;
}

export interface CrearFormularioCampoArgs {
  cliente: { id?: string; codigo?: string; razonSocial: string };
  sede: { id?: string; nombre: string; direccion?: string };
  servicio: {
    id: string;
    tipo: string;
    tipoServicio?: TipoServicio;
    requiereCertificado?: boolean;
    insumosAutorizados?: string[] | InsumoServicioConfig[];
    dosisReferencial?: Record<string, string>;
    equiposAutorizados?: string[] | EquipoCatalogoItem[];
  };
  fecha?: string;
  horaInicio?: string;
  horaFin?: string;
  tecnicoId?: string;
  tecnicoNombre?: string;
}

function vacio(v: string | null | undefined): boolean {
  return !v || v.trim() === '';
}

function numeroEntre(v: string, min: number, max: number): boolean {
  if (vacio(v)) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max;
}

function hoyFechaIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ahoraHoraIso(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Pre-carga el formulario de campo por bloques (§4, §8.2) con:
 * - Identificación (Cliente, Sede, Servicio)
 * - Insumos químicos autorizados con dosis referencial
 * - Equipos autorizados asignados
 * - Técnico que inicia la labor
 */
export function crearFormularioCampo({
  cliente,
  sede,
  servicio,
  fecha,
  horaInicio,
  horaFin,
  tecnicoId,
  tecnicoNombre,
}: CrearFormularioCampoArgs): FormularioCampo {
  const fechaEfectiva = fecha || hoyFechaIso();
  const horaInicioEfectiva = horaInicio || ahoraHoraIso();
  const horaFinEfectiva = horaFin || '';

  // Determinar TipoServicio a partir del tipo proporcionado
  let tipoServicio: TipoServicio = 'DRT';
  const tipoUpper = (servicio.tipoServicio || servicio.tipo || '').toUpperCase();
  if (tipoUpper.includes('DSF') || tipoUpper.includes('DESINFECCION')) {
    tipoServicio = 'DSF';
  } else if (tipoUpper.includes('DSS') || tipoUpper.includes('DESINSECTACION')) {
    tipoServicio = 'DSS';
  } else if (tipoUpper.includes('DRT') || tipoUpper.includes('DESRATIZACION') || tipoUpper.includes('ROEDOR')) {
    tipoServicio = 'DRT';
  } else if (tipoUpper.includes('LRA')) {
    tipoServicio = 'LRA';
  } else if (tipoUpper.includes('LTG')) {
    tipoServicio = 'LTG';
  } else if (tipoUpper.includes('LTS')) {
    tipoServicio = 'LTS';
  } else if (tipoUpper.includes('LAM')) {
    tipoServicio = 'LAM';
  }

  // Resolver insumos autorizados precargados con dosis referencial
  const insumosConfig = servicio.insumosAutorizados || [];
  const insumosAplicados: InsumoAplicado[] = [];

  if (insumosConfig.length > 0) {
    for (const item of insumosConfig) {
      const insumoId = typeof item === 'string' ? item : item.insumoId;
      const catalogoItem = INSUMOS_CATALOGO_SEMILLA.find((i) => i.id === insumoId);
      const nombreComercial =
        typeof item === 'object' && item.nombreComercial
          ? item.nombreComercial
          : catalogoItem?.nombreComercial || `Insumo ${insumoId.slice(0, 8)}`;
      const principioActivo =
        typeof item === 'object' && item.principioActivo
          ? item.principioActivo
          : catalogoItem?.principioActivo || '';
      const dosisRef =
        (servicio.dosisReferencial && servicio.dosisReferencial[insumoId]) ||
        (typeof item === 'object' && item.dosisReferencial) ||
        catalogoItem?.dosisReferencial ||
        'Dosis estándar de catálogo';

      insumosAplicados.push({
        insumoId,
        nombreComercial,
        principioActivo,
        dosisReferencial: dosisRef,
        dosisReal: dosisRef,
        aplicado: true,
        lote: '',
        vencimiento: '',
        cantidad: '',
        unidad: catalogoItem?.unidadMedida?.toLowerCase() || 'l',
        zonas: '',
      });
    }
  } else {
    // Si el servicio no tiene insumos explícitos en su contrato, precarga insumos sugeridos por tipo
    const sugeridos = tipoServicio === 'DRT'
      ? [INSUMOS_CATALOGO_SEMILLA[1]] // Brodifacoum
      : [INSUMOS_CATALOGO_SEMILLA[0]]; // Cipermetrina

    for (const cat of sugeridos) {
      insumosAplicados.push({
        insumoId: cat.id,
        nombreComercial: cat.nombreComercial,
        principioActivo: cat.principioActivo,
        dosisReferencial: cat.dosisReferencial,
        dosisReal: cat.dosisReferencial,
        aplicado: true,
        lote: '',
        vencimiento: '',
        cantidad: '',
        unidad: cat.unidadMedida?.toLowerCase() || 'l',
        zonas: '',
      });
    }
  }

  // Resolver equipos autorizados
  const equiposConfig = servicio.equiposAutorizados || [];
  const equiposIds: string[] = [];
  if (equiposConfig.length > 0) {
    for (const eq of equiposConfig) {
      equiposIds.push(typeof eq === 'string' ? eq : eq.id);
    }
  } else {
    // Equipos sugeridos
    equiposIds.push(EQUIPOS_CATALOGO_SEMILLA[0].id); // Motomochila o aspersora
  }

  const personalInicial: string[] = [];
  if (tecnicoNombre || tecnicoId) {
    personalInicial.push(tecnicoNombre || tecnicoId || 'Técnico Operador');
  }

  return {
    id: `${cliente.id || 'cli'}__${sede.id || 'sede'}__${servicio.id}__${fechaEfectiva}`,
    clienteId: cliente.id,
    clienteCodigo: cliente.codigo,
    clienteRazon: cliente.razonSocial,
    proyectoId: sede.id,
    proyectoNombre: sede.nombre,
    servicioId: servicio.id,
    servicioEtiqueta: servicio.tipo,
    tipoServicio,
    requiereCertificado: Boolean(servicio.requiereCertificado),
    fecha: fechaEfectiva,
    horaInicio: horaInicioEfectiva,
    horaFin: horaFinEfectiva,
    personal: personalInicial,
    equipos: equiposIds,
    insumos: insumosAplicados,
    metodos: [tipoServicio === 'DRT' ? 'Cebado' : 'Aspersión'],
    temperatura: '',
    humedad: '',
    viento: '',
    estadoGeneral: '',
    nivelInfestacion: '',
    hallazgos: [],
    hallazgosDetalle: '',
    acciones: [],
    observaciones: [],
    observacionesLibre: '',
    recomendaciones: [],
    fotos: [],
    firma: null,
    firmanteNombre: '',
    firmanteCargo: '',
    responsableNoDisponible: false,
    certificadoNumero: '',
    certificadoEmision: '',
    certificadoVencimiento: '',
    estado: 'BORRADOR',
    guardados: [],
  };
}

/**
 * Valida los bloques obligatorios requeridos para cerrar una inspección (§4, §8.2).
 * El borrador parcial puede guardarse sin validar; el cierre es estricto.
 */
export function validarCierre(f: FormularioCampo): Partial<Record<BloqueCierre, string>> {
  const errores: Partial<Record<BloqueCierre, string>> = {};

  // Bloque 1: Personal
  if (f.personal.length === 0) {
    errores.personal = 'Debe registrar al menos un técnico que intervino en el servicio.';
  }

  // Bloque 2: Herramientas y equipos
  if (f.equipos.length === 0) {
    errores.equipos = 'Marque al menos un equipo o herramienta utilizado en campo.';
  }

  // Bloque 3: Insumos químicos
  const aplicados = f.insumos.filter((i) => i.aplicado);
  if (aplicados.length === 0) {
    errores.insumos = 'Marque al menos un insumo aplicado en la inspección.';
  } else {
    const tieneCamposIncompletos = aplicados.some(
      (i) =>
        vacio(i.lote) ||
        vacio(i.vencimiento) ||
        !(Number(i.cantidad) > 0) ||
        vacio(i.zonas),
    );
    if (tieneCamposIncompletos) {
      errores.insumos =
        'Complete lote, fecha de vencimiento, cantidad (> 0) y zonas tratadas de cada insumo aplicado.';
    }
  }

  // Bloque 4: Métodos de aplicación
  if (f.metodos.length === 0) {
    errores.metodos = 'Seleccione al menos un método de aplicación empleado.';
  }

  // Bloque 5: Condiciones ambientales
  if (
    !numeroEntre(f.temperatura, -20, 60) ||
    !numeroEntre(f.humedad, 0, 100) ||
    !numeroEntre(f.viento, 0, 200)
  ) {
    errores.condiciones =
      'Registre temperatura (-20 a 60 °C), humedad (0 a 100 %) y velocidad del viento (0 a 200 km/h).';
  }

  // Bloque 6: Diagnóstico y hallazgos
  if (vacio(f.estadoGeneral) || vacio(f.nivelInfestacion)) {
    errores.diagnostico = 'Indique el estado general y el nivel de infestación.';
  }

  // Bloque 7: Conformidad del cliente
  if (!f.responsableNoDisponible) {
    if (vacio(f.firmanteNombre) || vacio(f.firmanteCargo)) {
      errores.conformidad =
        'Ingrese nombre y cargo del contacto responsable del cliente, o marque "Responsable no disponible".';
    } else if (!f.firma) {
      errores.conformidad =
        'Debe registrar la firma de conformidad o marcar que el responsable no estuvo disponible.';
    }
  }

  // Bloque 8: Certificado (si aplica)
  if (f.requiereCertificado) {
    if (
      vacio(f.certificadoNumero) ||
      vacio(f.certificadoEmision) ||
      vacio(f.certificadoVencimiento)
    ) {
      errores.certificado =
        'Complete número de certificado, fecha de emisión y fecha de vencimiento.';
    } else if (
      f.certificadoVencimiento &&
      f.certificadoEmision &&
      f.certificadoVencimiento <= f.certificadoEmision
    ) {
      errores.certificado =
        'La fecha de vencimiento del certificado debe ser posterior a la de emisión.';
    }
  }

  return errores;
}

/**
 * Registra un evento de guardado parcial en el historial del borrador.
 */
export function registrarGuardado(
  f: FormularioCampo,
  usuario: string,
  fechaHora: string,
): FormularioCampo {
  return {
    ...f,
    guardados: [
      ...f.guardados,
      { usuario, fechaHora, accion: 'Guardado parcial' },
    ],
  };
}

/**
 * Cierra la inspección: valida todos los bloques obligatorios, pasa a ENVIADO_A_REVISION
 * y registra los eventos de cierre.
 */
export function cerrarFormulario(
  f: FormularioCampo,
  usuario: string,
  fechaHora: string,
): FormularioCampo {
  const errores = validarCierre(f);
  if (Object.keys(errores).length > 0) {
    const primerError = Object.values(errores)[0];
    throw new Error(`El formulario no está completo para cerrarse: ${primerError}`);
  }

  return {
    ...f,
    estado: 'ENVIADO_A_REVISION',
    guardados: [
      ...f.guardados,
      { usuario, fechaHora, accion: 'Cierre de inspección' },
      { usuario, fechaHora, accion: 'Enviado a revisión' },
    ],
  };
}

/**
 * Mapea el formulario de campo al contrato estándar CerrarInspeccion de @gafer/contracts.
 */
export function aCerrarInspeccionPayload(f: FormularioCampo): CerrarInspeccion {
  const consumos: ConsumoInsumo[] = f.insumos
    .filter((i) => i.aplicado && Number(i.cantidad) > 0)
    .map((i) => ({
      insumoId: i.insumoId,
      dosisAplicada: i.dosisReal || i.dosisReferencial || 'Dosis aplicada en campo',
      lote: i.lote,
      cantidadUtilizada: Number(i.cantidad),
    }));

  return {
    consumos,
    equiposIds: f.equipos,
    personalIds: undefined,
  };
}

/**
 * Tipo de documento que genera el servicio: DRT genera Reporte de Inspección; el resto, Informe de Servicio (§2).
 */
export function tipoDocumentoDe(tipo: TipoServicio): TipoDocumento {
  return tipo === 'DRT' ? 'REPORTE' : 'INFORME';
}
