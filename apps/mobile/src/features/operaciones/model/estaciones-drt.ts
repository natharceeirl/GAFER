import {
  ColorIcono,
  EstadoEstacionPlanilla,
  EstadoFisicoEstacion,
  ItemEstacionPlanilla,
  ItemEstacionPlanillaSchema,
  OperacionSync,
  OperacionSyncSchema,
  PayloadEstacionSync,
  PayloadEstacionSyncSchema,
  PorcentajeConsumo,
} from '@gafer/contracts';

/**
 * Porcentajes de consumo de cebo válidos en pasos de 25 (§5.1, GAF-35).
 */
export const PORCENTAJES_CONSUMO: readonly PorcentajeConsumo[] = [0, 25, 50, 75, 100];

/**
 * Porcentajes válidos cuando se confirma que hubo consumo de cebo (> 0%).
 */
export const PORCENTAJES_CON_CONSUMO: readonly PorcentajeConsumo[] = [25, 50, 75, 100];

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
 * Metadatos de autoría y marca temporal para resolución LWW (§8.2, GAF-37).
 */
export interface MetadataActualizacionEstacion {
  actualizadoEn?: string;
  actualizadoPor?: string;
}

function sellarActualizacionEstacion(
  estacion: ItemEstacionPlanilla,
  meta?: MetadataActualizacionEstacion,
): ItemEstacionPlanilla {
  return {
    ...estacion,
    actualizadoEn: meta?.actualizadoEn ?? new Date().toISOString(),
    ...(meta?.actualizadoPor !== undefined
      ? { actualizadoPor: meta.actualizadoPor }
      : estacion.actualizadoPor !== undefined
        ? { actualizadoPor: estacion.actualizadoPor }
        : {}),
  };
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
    ...(config?.actualizadoEn !== undefined ? { actualizadoEn: config.actualizadoEn } : {}),
    ...(config?.actualizadoPor !== undefined ? { actualizadoPor: config.actualizadoPor } : {}),
  };
}

/**
 * Configura la planilla según si la visita es la primera visita (Instalación de estaciones).
 * En la primera visita (§5.1):
 * - Se instalan las estaciones con cebo inicial, lote, vencimiento y estado físico.
 * - Preserva los valores personalizados ya configurados en cada estación (ceboDefecto solo completa faltantes).
 * - NO se evalúa consumo (huboConsumo = false, porcentajeConsumo = 0, consumoGramos = 0).
 */
export function aplicarPrimeraVisita(
  estaciones: ItemEstacionPlanilla[],
  esPrimera: boolean,
  ceboDefecto?: Partial<Pick<ItemEstacionPlanilla, 'tipoCebo' | 'cantidadGramos' | 'lote' | 'vencimiento'>>,
  meta?: MetadataActualizacionEstacion,
): ItemEstacionPlanilla[] {
  const ahora = meta?.actualizadoEn ?? new Date().toISOString();
  const metaResuelta: MetadataActualizacionEstacion = {
    actualizadoEn: ahora,
    actualizadoPor: meta?.actualizadoPor,
  };
  return estaciones.map((est) => {
    if (esPrimera) {
      return sellarActualizacionEstacion(
        {
          ...est,
          esInstalacion: true,
          huboConsumo: false,
          porcentajeConsumo: 0,
          consumoGramos: 0,
          repuestoGramos: 0,
          cantidadReposicion: 0,
          estado: 'SIN_ACTIVIDAD',
          estadoFisico: est.estadoFisico || 'BUENAS_CONDICIONES',
          tipoCebo: est.tipoCebo?.trim() ? est.tipoCebo : (ceboDefecto?.tipoCebo ?? 'BLOQUE_10G'),
          cantidadGramos:
            est.cantidadGramos !== undefined && est.cantidadGramos > 0
              ? est.cantidadGramos
              : (ceboDefecto?.cantidadGramos ?? 20),
          lote: est.lote?.trim() ? est.lote : (ceboDefecto?.lote ?? 'LOTE-001'),
          vencimiento: est.vencimiento?.trim() ? est.vencimiento : (ceboDefecto?.vencimiento ?? '2026-12-31'),
        },
        metaResuelta,
      );
    } else {
      return sellarActualizacionEstacion(
        {
          ...est,
          esInstalacion: false,
        },
        metaResuelta,
      );
    }
  });
}

/**
 * Actualiza el registro de consumo de una estación (§5.1).
 * Si hubo consumo (> 0%):
 * - Registra el porcentaje (25, 50, 75 o 100).
 * - Calcula automáticamente los gramos consumidos en base a la dosis instalada.
 * - Asigna la cantidad de reposición por defecto igual a los gramos consumidos para rellenar al 100%.
 * - Marca el estado de la estación como CON_CONSUMO.
 * Si no hubo consumo (o porcentaje === 0):
 * - Resetea porcentaje, consumo y reposición a 0.
 * - Si el estado era CON_CONSUMO, pasa a SIN_ACTIVIDAD.
 */
export function actualizarConsumoEstacion(
  estacion: ItemEstacionPlanilla,
  huboConsumo: boolean,
  porcentaje: PorcentajeConsumo = 25,
  meta?: MetadataActualizacionEstacion,
): ItemEstacionPlanilla {
  if (!huboConsumo || porcentaje === 0) {
    return sellarActualizacionEstacion(
      {
        ...estacion,
        huboConsumo: false,
        porcentajeConsumo: 0,
        consumoGramos: 0,
        repuestoGramos: 0,
        cantidadReposicion: 0,
        estado: estacion.estado === 'CON_CONSUMO' ? 'SIN_ACTIVIDAD' : estacion.estado,
      },
      meta,
    );
  }

  const p = porcentaje;
  const gramosBase = estacion.cantidadGramos ?? 20;
  const cGramos = calcularConsumoGramos(gramosBase, p);

  return sellarActualizacionEstacion(
    {
      ...estacion,
      huboConsumo: true,
      porcentajeConsumo: p,
      consumoGramos: cGramos,
      repuestoGramos: cGramos,
      cantidadReposicion: cGramos,
      estado: 'CON_CONSUMO',
    },
    meta,
  );
}

/**
 * Cambia el estado del punto de control manteniendo consistencia con huboConsumo y métricas de consumo.
 */
export function actualizarEstadoEstacion(
  estacion: ItemEstacionPlanilla,
  nuevoEstado: EstadoEstacionPlanilla,
  meta?: MetadataActualizacionEstacion,
): ItemEstacionPlanilla {
  if (nuevoEstado === 'CON_CONSUMO') {
    if (estacion.huboConsumo && estacion.porcentajeConsumo && estacion.porcentajeConsumo > 0) {
      return sellarActualizacionEstacion(
        {
          ...estacion,
          estado: 'CON_CONSUMO',
          huboConsumo: true,
        },
        meta,
      );
    }
    const porcentajeInicial: PorcentajeConsumo =
      estacion.porcentajeConsumo && estacion.porcentajeConsumo > 0
        ? estacion.porcentajeConsumo
        : 25;
    return actualizarConsumoEstacion(estacion, true, porcentajeInicial, meta);
  }

  return sellarActualizacionEstacion(
    {
      ...estacion,
      estado: nuevoEstado,
      huboConsumo: false,
      porcentajeConsumo: 0,
      consumoGramos: 0,
      repuestoGramos: 0,
      cantidadReposicion: 0,
    },
    meta,
  );
}

/**
 * Actualiza los gramos base instalados y recalcula consumo y reposición de forma coherente.
 */
export function actualizarCantidadGramosEstacion(
  estacion: ItemEstacionPlanilla,
  cantidadGramos: number,
  meta?: MetadataActualizacionEstacion,
): ItemEstacionPlanilla {
  const gramosSeguros = Number.isFinite(cantidadGramos) && cantidadGramos >= 0 ? cantidadGramos : 0;
  const tieneConsumo = Boolean(
    estacion.huboConsumo && estacion.porcentajeConsumo && estacion.porcentajeConsumo > 0,
  );
  const recalculado = tieneConsumo
    ? calcularConsumoGramos(gramosSeguros, estacion.porcentajeConsumo!)
    : 0;

  return sellarActualizacionEstacion(
    {
      ...estacion,
      cantidadGramos: gramosSeguros,
      consumoGramos: recalculado,
      repuestoGramos: recalculado,
      cantidadReposicion: recalculado,
    },
    meta,
  );
}

/**
 * Actualiza el estado físico de la estación (BUENAS_CONDICIONES / MALAS_CONDICIONES).
 */
export function actualizarEstadoFisicoEstacion(
  estacion: ItemEstacionPlanilla,
  estadoFisico: EstadoFisicoEstacion,
  observaciones?: string,
  meta?: MetadataActualizacionEstacion,
): ItemEstacionPlanilla {
  return sellarActualizacionEstacion(
    {
      ...estacion,
      estadoFisico,
      ...(observaciones !== undefined ? { observaciones } : {}),
    },
    meta,
  );
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
  meta?: MetadataActualizacionEstacion,
): ItemEstacionPlanilla[] {
  const ahora = meta?.actualizadoEn ?? new Date().toISOString();
  const metaResuelta: MetadataActualizacionEstacion = {
    actualizadoEn: ahora,
    actualizadoPor: meta?.actualizadoPor,
  };
  return estaciones.map((est) =>
    sellarActualizacionEstacion(
      {
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
      },
      metaResuelta,
    ),
  );
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

    if (!esPrimeraVisita) {
      const estadoSinConsumo =
        est.estado === 'SIN_ACTIVIDAD' || est.estado === 'SIN_ACCESO' || est.estado === 'EXTRAVIADA';
      const tieneDatosConsumo =
        est.huboConsumo === true ||
        (est.porcentajeConsumo ?? 0) > 0 ||
        (est.consumoGramos ?? 0) > 0;

      if (estadoSinConsumo && tieneDatosConsumo) {
        errores.push(
          `Estación #${est.numero}: El estado ${est.estado} es incompatible con registro de consumo.`,
        );
      }

      if (est.estado === 'CON_CONSUMO' && est.huboConsumo === false) {
        errores.push(
          `Estación #${est.numero}: El estado CON_CONSUMO requiere confirmar consumo de cebo.`,
        );
      }

      if (est.huboConsumo) {
        if (
          est.porcentajeConsumo === undefined ||
          !PORCENTAJES_CON_CONSUMO.includes(est.porcentajeConsumo)
        ) {
          errores.push(
            `Estación #${est.numero}: Al haber consumo, debe seleccionar un porcentaje mayor a 0% (25, 50, 75 o 100%).`,
          );
        }
      }
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}

/**
 * Construye y valida el payload canónico `REGISTRO_ESTACION` (§5.1 / Mapa Murino).
 *
 * - `huboConsumo` y `colorIcono` se derivan de una única fuente de verdad (en instalación siempre sin consumo / VERDE).
 * - `colorAura` representa la tendencia acumulada de consumo entre visitas (NO el estado físico):
 *   inicia en `SIN_COLOR` en primera visita (instalación) y se omite en visitas regulares para que el dominio
 *   del servidor calcule la transición a partir del historial de la estación.
 */
export function construirPayloadEstacionSync(
  est: ItemEstacionPlanilla,
  esPrimeraVisita = false,
): PayloadEstacionSync {
  const esInstalacion = est.esInstalacion ?? esPrimeraVisita;
  const huboConsumo = esInstalacion
    ? false
    : (est.huboConsumo ?? (est.estado === 'CON_CONSUMO'));
  const colorIcono: ColorIcono = huboConsumo ? 'ROJO' : 'VERDE';

  return PayloadEstacionSyncSchema.parse({
    numeroEstacion: est.numero,
    huboConsumo,
    porcentajeConsumo: huboConsumo ? (est.porcentajeConsumo ?? 0) : 0,
    cantidadGramos: est.cantidadGramos ?? 20,
    consumoGramos: huboConsumo ? (est.consumoGramos ?? 0) : 0,
    cantidadReposicion: est.cantidadReposicion ?? est.repuestoGramos ?? 0,
    tipoCebo: est.tipoCebo ?? 'BLOQUE_10G',
    lote: est.lote ?? 'LOTE-DEFAULT',
    vencimiento: est.vencimiento ?? '2026-12-31',
    estadoFisico: est.estadoFisico ?? 'BUENAS_CONDICIONES',
    esInstalacion,
    colorIcono,
    ...(esInstalacion ? { colorAura: 'SIN_COLOR' as const } : {}),
    observaciones: est.observaciones ?? '',
  });
}

/**
 * Convierte el registro de estaciones a operaciones de sincronización sync.v1 (REGISTRO_ESTACION).
 */
export function generarOperacionesSyncEstaciones(
  servicioId: string,
  tecnicoId: string,
  estaciones: ItemEstacionPlanilla[],
  clienteTimestamp?: string,
  esPrimeraVisita = false,
): OperacionSync[] {
  const timestamp = clienteTimestamp || new Date().toISOString();

  return estaciones.map((est) => {
    const payload = construirPayloadEstacionSync(est, esPrimeraVisita);
    return OperacionSyncSchema.parse({
      operationId: generarUuidOffline(),
      tipo: 'REGISTRO_ESTACION',
      agregadoId: servicioId,
      actorId: tecnicoId,
      clienteTimestamp: timestamp,
      payload: payload as unknown as Record<string, unknown>,
    });
  });
}
