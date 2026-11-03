import {
  ItemEstacionPlanilla,
  ItemEstacionPlanillaSchema,
  PorcentajeConsumo,
  EstadoFisicoEstacion,
  OperacionSync,
} from '@gafer/contracts';

/**
 * Porcentajes de consumo de cebo válidos en pasos de 25 (§5.1, GAF-35).
 */
export const PORCENTAJES_CONSUMO: readonly PorcentajeConsumo[] = [0, 25, 50, 75, 100];

/**
 * Estados físicos admitidos para la estación de control (§5.1).
 */
export const ESTADOS_FISICOS: readonly EstadoFisicoEstacion[] = [
  'BUENAS_CONDICIONES',
  'MALAS_CONDICIONES',
];

/**
 * Calcula los gramos consumidos según el peso base del cebo y el porcentaje observado (§5.1).
 */
export function calcularConsumoGramos(gramosBase: number, porcentaje: PorcentajeConsumo): number {
  if (gramosBase <= 0 || porcentaje <= 0) return 0;
  return Math.round((gramosBase * (porcentaje / 100)) * 100) / 100;
}

/**
 * Genera un UUID v4 criptográfico o pseudo-aleatorio para operaciones offline.
 */
function generarUuidOffline(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Crea una estación inicial para la planilla DRT.
 */
export function crearEstacionDrt(
  numero: number,
  config?: Partial<ItemEstacionPlanilla>,
): ItemEstacionPlanilla {
  return {
    numero,
    estado: config?.estado ?? 'SIN_ACTIVIDAD',
    tipoCebo: config?.tipoCebo ?? 'BLOQUE_10G',
    cantidadGramos: config?.cantidadGramos ?? 20,
    lote: config?.lote ?? 'LOTE-001',
    vencimiento: config?.vencimiento ?? '2026-12-31',
    huboConsumo: config?.huboConsumo ?? false,
    porcentajeConsumo: config?.porcentajeConsumo ?? 0,
    consumoGramos: config?.consumoGramos ?? 0,
    repuestoGramos: config?.repuestoGramos ?? 0,
    cantidadReposicion: config?.cantidadReposicion ?? 0,
    estadoFisico: config?.estadoFisico ?? 'BUENAS_CONDICIONES',
    esInstalacion: config?.esInstalacion ?? false,
    observaciones: config?.observaciones ?? '',
  };
}

/**
 * Configura la planilla según si la visita es la primera visita (Instalación de estaciones).
 * En la primera visita (§5.1):
 * - Se instalan las estaciones con cebo inicial, lote, vencimiento y estado físico.
 * - NO se evalúa consumo (huboConsumo = false, porcentajeConsumo = 0, consumoGramos = 0).
 */
export function aplicarPrimeraVisita(
  estaciones: ItemEstacionPlanilla[],
  esPrimera: boolean,
  ceboDefecto?: Partial<Pick<ItemEstacionPlanilla, 'tipoCebo' | 'cantidadGramos' | 'lote' | 'vencimiento'>>,
): ItemEstacionPlanilla[] {
  return estaciones.map((est) => {
    if (esPrimera) {
      return {
        ...est,
        esInstalacion: true,
        huboConsumo: false,
        porcentajeConsumo: 0,
        consumoGramos: 0,
        repuestoGramos: 0,
        cantidadReposicion: 0,
        estado: 'SIN_ACTIVIDAD',
        estadoFisico: est.estadoFisico || 'BUENAS_CONDICIONES',
        tipoCebo: ceboDefecto?.tipoCebo ?? est.tipoCebo ?? 'BLOQUE_10G',
        cantidadGramos: ceboDefecto?.cantidadGramos ?? est.cantidadGramos ?? 20,
        lote: ceboDefecto?.lote ?? est.lote ?? 'LOTE-001',
        vencimiento: ceboDefecto?.vencimiento ?? est.vencimiento ?? '2026-12-31',
      };
    } else {
      return {
        ...est,
        esInstalacion: false,
      };
    }
  });
}

/**
 * Actualiza el registro de consumo de una estación (§5.1).
 * Si hubo consumo:
 * - Registra el porcentaje (0, 25, 50, 75 o 100).
 * - Calcula automáticamente los gramos consumidos en base a la dosis instalada.
 * - Asigna la cantidad de reposición por defecto igual a los gramos consumidos para rellenar al 100%.
 * - Marca el estado de la estación como CON_CONSUMO.
 * Si no hubo consumo:
 * - Resetea porcentaje y consumo a 0.
 * - Marca el estado como SIN_ACTIVIDAD.
 */
export function actualizarConsumoEstacion(
  estacion: ItemEstacionPlanilla,
  huboConsumo: boolean,
  porcentaje: PorcentajeConsumo = 25,
): ItemEstacionPlanilla {
  if (!huboConsumo) {
    return {
      ...estacion,
      huboConsumo: false,
      porcentajeConsumo: 0,
      consumoGramos: 0,
      repuestoGramos: 0,
      cantidadReposicion: 0,
      estado: estacion.estado === 'CON_CONSUMO' ? 'SIN_ACTIVIDAD' : estacion.estado,
    };
  }

  const p = porcentaje;
  const gramosBase = estacion.cantidadGramos ?? 20;
  const cGramos = calcularConsumoGramos(gramosBase, p);

  return {
    ...estacion,
    huboConsumo: true,
    porcentajeConsumo: p,
    consumoGramos: cGramos,
    repuestoGramos: cGramos,
    cantidadReposicion: cGramos,
    estado: 'CON_CONSUMO',
  };
}

/**
 * Actualiza el estado físico de la estación (BUENAS_CONDICIONES / MALAS_CONDICIONES).
 */
export function actualizarEstadoFisicoEstacion(
  estacion: ItemEstacionPlanilla,
  estadoFisico: EstadoFisicoEstacion,
  observaciones?: string,
): ItemEstacionPlanilla {
  return {
    ...estacion,
    estadoFisico,
    ...(observaciones !== undefined ? { observaciones } : {}),
  };
}

/**
 * Acción rápida para aplicar la misma formulación de cebo, lote y vencimiento a todas las estaciones.
 */
export function copiarCeboALote(
  estaciones: ItemEstacionPlanilla[],
  cebo: {
    tipoCebo: string;
    cantidadGramos: number;
    lote: string;
    vencimiento: string;
  },
): ItemEstacionPlanilla[] {
  return estaciones.map((est) => ({
    ...est,
    tipoCebo: cebo.tipoCebo,
    cantidadGramos: cebo.cantidadGramos,
    lote: cebo.lote,
    vencimiento: cebo.vencimiento,
    // Si la estación ya tenía consumo, recalcular gramos en base al nuevo peso base
    ...(est.huboConsumo && est.porcentajeConsumo
      ? {
          consumoGramos: calcularConsumoGramos(cebo.cantidadGramos, est.porcentajeConsumo),
          repuestoGramos: calcularConsumoGramos(cebo.cantidadGramos, est.porcentajeConsumo),
          cantidadReposicion: calcularConsumoGramos(cebo.cantidadGramos, est.porcentajeConsumo),
        }
      : {}),
  }));
}

/**
 * Valida que los datos de las estaciones cumplan los requerimientos técnicos de §5.1.
 */
export function validarEstacionesPlanilla(
  estaciones: ItemEstacionPlanilla[],
  esPrimeraVisita = false,
): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (estaciones.length === 0) {
    errores.push('Debe registrar al menos una estación de control en la planilla.');
    return { valido: false, errores };
  }

  for (const est of estaciones) {
    const parseResult = ItemEstacionPlanillaSchema.safeParse(est);
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        errores.push(`Estación #${est.numero}: Campo '${issue.path.join('.') || 'estacion'}' inválido (${issue.message})`);
      }
    }

    if (!est.tipoCebo || est.tipoCebo.trim() === '') {
      errores.push(`Estación #${est.numero}: Debe especificar el tipo de cebo.`);
    }

    if (!est.cantidadGramos || est.cantidadGramos <= 0) {
      errores.push(`Estación #${est.numero}: La cantidad en gramos instalada debe ser mayor a 0.`);
    }

    if (!est.lote || est.lote.trim() === '') {
      errores.push(`Estación #${est.numero}: Debe especificar el lote del cebo.`);
    }

    if (!est.vencimiento || !/^\d{4}-\d{2}-\d{2}$/.test(est.vencimiento)) {
      errores.push(`Estación #${est.numero}: Debe especificar una fecha de vencimiento válida (YYYY-MM-DD).`);
    }

    if (!est.estadoFisico) {
      errores.push(`Estación #${est.numero}: Debe registrar el estado físico (Buenas / Malas condiciones).`);
    }

    if (est.estadoFisico === 'MALAS_CONDICIONES' && (!est.observaciones || est.observaciones.trim() === '')) {
      errores.push(`Estación #${est.numero}: Debe detallar el daño en observaciones al marcar malas condiciones.`);
    }

    if ((est.estado === 'SIN_ACCESO' || est.estado === 'EXTRAVIADA') && (!est.observaciones || est.observaciones.trim() === '')) {
      errores.push(`Estación #${est.numero}: Debe indicar el motivo en observaciones (${est.estado}).`);
    }

    if (!esPrimeraVisita && est.huboConsumo) {
      if (est.porcentajeConsumo === undefined || !PORCENTAJES_CONSUMO.includes(est.porcentajeConsumo)) {
        errores.push(`Estación #${est.numero}: Al haber consumo, debe seleccionar un porcentaje válido (0, 25, 50, 75, 100%).`);
      }
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}

/**
 * Convierte el registro de estaciones a operaciones de sincronización sync.v1 (REGISTRO_ESTACION).
 */
export function generarOperacionesSyncEstaciones(
  servicioId: string,
  tecnicoId: string,
  estaciones: ItemEstacionPlanilla[],
  clienteTimestamp?: string,
): OperacionSync[] {
  const timestamp = clienteTimestamp || new Date().toISOString();

  return estaciones.map((est) => ({
    operationId: generarUuidOffline(),
    tipo: 'REGISTRO_ESTACION',
    agregadoId: servicioId,
    actorId: tecnicoId,
    clienteTimestamp: timestamp,
    payload: {
      numeroEstacion: est.numero,
      huboConsumo: est.huboConsumo ?? (est.estado === 'CON_CONSUMO'),
      porcentajeConsumo: est.porcentajeConsumo ?? 0,
      cantidadGramos: est.cantidadGramos ?? 20,
      consumoGramos: est.consumoGramos ?? 0,
      cantidadReposicion: est.cantidadReposicion ?? est.repuestoGramos ?? 0,
      tipoCebo: est.tipoCebo ?? 'BLOQUE_10G',
      lote: est.lote ?? 'LOTE-DEFAULT',
      vencimiento: est.vencimiento ?? '2026-12-31',
      estadoFisico: est.estadoFisico ?? 'BUENAS_CONDICIONES',
      esInstalacion: est.esInstalacion ?? false,
      colorIcono: est.huboConsumo ? 'ROJO' : 'VERDE',
      colorAura: est.estadoFisico === 'MALAS_CONDICIONES' ? 'ROJO' : 'VERDE',
      observaciones: est.observaciones ?? '',
    },
  }));
}
