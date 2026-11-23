/**
 * GAFER Mobile — Trabajo Colaborativo y Resolución de Conflictos (§8.2, GAF-37)
 *
 * Reglas de negocio innegociables (§8.2):
 * 1. Guardar como borrador en cualquier momento con técnico, fecha y hora.
 * 2. Varios técnicos en el mismo proyecto: si dos registran la misma estación,
 *    prevalece el último dato (Last-Write-Wins / LWW).
 * 3. Ninguna estación registrada por otro técnico se pierde (unión idempotente de conjuntos).
 * 4. Al cerrar la inspección se bloquea para todos los dispositivos y pasa a revisión.
 */

import {
  ActaServicioDrt,
  ItemEstacionPlanilla,
  FotoEvidenciaDrt,
} from '@gafer/contracts';

export interface ConflictoEstacionResuelto {
  numeroEstacion: number;
  estacionGanadora: ItemEstacionPlanilla;
  estacionDesplazada: ItemEstacionPlanilla;
  motivo: string;
  ganador: 'LOCAL' | 'REMOTO';
}

export interface ResultadoFusionEstaciones {
  estaciones: ItemEstacionPlanilla[];
  conflictos: ConflictoEstacionResuelto[];
  totalEstaciones: number;
}

export interface MetadataTecnicoBorrador {
  tecnicoId?: string;
  tecnicoNombre?: string;
  tecnicoCargo?: string;
  guardadoEn?: string;
}

export interface EstadoBloqueoInspeccion {
  bloqueada: boolean;
  motivo?: string;
  cerradaPor?: string;
  cerradaEn?: string;
}

/**
 * Compara dos marcas de tiempo ISO de manera segura para la regla LWW.
 * Retorna > 0 si b es más reciente que a; < 0 si a es más reciente que b; 0 si son iguales o indeterminadas.
 */
export function compararTimestampsIso(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1; // b tiene timestamp, a no -> b prevalece
  if (!b) return -1; // a tiene timestamp, b no -> a prevalece

  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();

  if (isNaN(timeA) || isNaN(timeB)) return 0;
  return timeB - timeA;
}

/**
 * Fusiona dos listas de estaciones de control según la regla Last-Write-Wins (LWW) de §8.2.
 * Si dos técnicos registran la misma estación, prevalece el dato más reciente según timestamp.
 * Si una estación solo fue registrada por uno de los técnicos, se preserva íntegramente.
 */
export function fusionarEstacionesLww(
  estacionesLocales: ItemEstacionPlanilla[],
  estacionesRemotas: ItemEstacionPlanilla[],
): ResultadoFusionEstaciones {
  const mapa = new Map<number, ItemEstacionPlanilla>();
  const conflictos: ConflictoEstacionResuelto[] = [];

  // 1. Cargar estaciones base locales
  for (const est of estacionesLocales) {
    mapa.set(est.numero, est);
  }

  // 2. Evaluar estaciones remotas contra locales
  for (const remota of estacionesRemotas) {
    const local = mapa.get(remota.numero);

    if (!local) {
      // Estación nueva registrada por el otro técnico -> se agrega sin colisión
      mapa.set(remota.numero, remota);
      continue;
    }

    // Colisión detectada en la misma estación (§8.2)
    // Regla LWW: comparar marcas de tiempo de actualización
    const diff = compararTimestampsIso(local.actualizadoEn, remota.actualizadoEn);

    if (diff > 0) {
      // Remota es estrictamente más reciente -> prevalece remota
      conflictos.push({
        numeroEstacion: remota.numero,
        estacionGanadora: remota,
        estacionDesplazada: local,
        motivo: `Colisión en estación ${remota.numero}: prevalece dato remoto más reciente (${remota.actualizadoEn || 'reciente'} vs ${local.actualizadoEn || 'anterior'})`,
        ganador: 'REMOTO',
      });
      mapa.set(remota.numero, remota);
    } else if (diff < 0) {
      // Local es estrictamente más reciente -> prevalece local
      conflictos.push({
        numeroEstacion: remota.numero,
        estacionGanadora: local,
        estacionDesplazada: remota,
        motivo: `Colisión en estación ${remota.numero}: prevalece dato local más reciente (${local.actualizadoEn || 'reciente'} vs ${remota.actualizadoEn || 'anterior'})`,
        ganador: 'LOCAL',
      });
      // Mantiene local en el mapa
    } else {
      // Sin timestamps concluyentes o timestamps idénticos -> prevalece actualización entrante (remota)
      conflictos.push({
        numeroEstacion: remota.numero,
        estacionGanadora: remota,
        estacionDesplazada: local,
        motivo: `Colisión en estación ${remota.numero}: timestamps simultáneos, prevalece actualización entrante`,
        ganador: 'REMOTO',
      });
      mapa.set(remota.numero, remota);
    }
  }

  // Ordenar numéricamente por identificador de estación
  const estaciones = Array.from(mapa.values()).sort((a, b) => a.numero - b.numero);

  return {
    estaciones,
    conflictos,
    totalEstaciones: estaciones.length,
  };
}

/**
 * Fusiona fotografías de evidencia asegurando que no se dupliquen por SHA-256 ni por ID.
 */
export function fusionarFotosEvidencia(
  fotosA: FotoEvidenciaDrt[] = [],
  fotosB: FotoEvidenciaDrt[] = [],
): FotoEvidenciaDrt[] {
  const mapaHashes = new Set<string>();
  const fotosUnificadas: FotoEvidenciaDrt[] = [];

  for (const foto of [...fotosA, ...fotosB]) {
    const clave = foto.sha256 || foto.id;
    if (!mapaHashes.has(clave)) {
      mapaHashes.add(clave);
      fotosUnificadas.push(foto);
    }
  }

  return fotosUnificadas;
}

const ESTADOS_INSPECCION_BLOQUEADOS = new Set([
  'CERRADO',
  'ENVIADO_A_REVISION',
  'EN_REVISION',
  'APROBADO',
]);

const SYNC_STATUS_BLOQUEADOS = new Set(['LOCKED', 'CLOSED']);

function tieneFirmaManuscrita(firmas?: ActaServicioDrt['firmas']): boolean {
  if (!firmas) return false;
  const tieneBase64 = Boolean(
    firmas.firmaDigitalBase64 && firmas.firmaDigitalBase64.trim().length > 0,
  );
  const tieneArchivo = Boolean(firmas.firmaArchivoId && firmas.firmaRutaLocalRelativa);
  return tieneBase64 || tieneArchivo;
}

function fusionarTextoColaborativo(textoLocal?: string, textoRemoto?: string): string {
  const segmentosUnicos = new Set<string>();
  for (const texto of [textoLocal, textoRemoto]) {
    if (!texto) continue;
    for (const parte of texto.split(/\s*\|\s*/)) {
      const limpia = parte.trim();
      if (limpia.length > 0) {
        segmentosUnicos.add(limpia);
      }
    }
  }
  return Array.from(segmentosUnicos).join(' | ');
}

function fusionarContador(
  valorLocal: number,
  valorRemoto: number | undefined,
  diffActa: number,
): number {
  if (valorRemoto === undefined) return valorLocal;
  if (diffActa > 0) return valorRemoto;
  if (diffActa < 0) return valorLocal;
  return Math.max(valorLocal, valorRemoto);
}

/**
 * Evalúa si una inspección está bloqueada para edición de campo (§8.2).
 */
export function verificarBloqueoInspeccion(
  acta: Partial<ActaServicioDrt> & {
    bloqueada?: boolean;
    syncStatus?: string;
    estado?: string;
  },
): EstadoBloqueoInspeccion {
  const bloqueadaPorEstado = Boolean(acta.estado && ESTADOS_INSPECCION_BLOQUEADOS.has(acta.estado));
  const bloqueadaPorSync = Boolean(acta.syncStatus && SYNC_STATUS_BLOQUEADOS.has(acta.syncStatus));

  if (acta.cerradaEnRevision || acta.bloqueada || bloqueadaPorEstado || bloqueadaPorSync) {
    return {
      bloqueada: true,
      motivo: 'La inspección está cerrada y no acepta más sincronizaciones ni modificaciones de campo (Sección 8.2)',
      cerradaPor: acta.cerradoPor,
      cerradaEn: acta.actualizadoEn,
    };
  }

  return {
    bloqueada: false,
  };
}

/**
 * Fusiona dos actas de servicio colaborativas (ej. de dos técnicos trabajando el mismo proyecto).
 * - Aplica resolución LWW a las estaciones.
 * - Concatena fotos únicas sin pérdida de evidencias.
 * - Fusión no destructiva e idempotente de firmas, especies, contadores y observaciones.
 * - Bloquea el acta resultante si cualquiera de las dos fue cerrada (§8.2).
 */
export function fusionarActasColaborativas(
  actaLocal: ActaServicioDrt,
  actaRemota: ActaServicioDrt,
): { acta: ActaServicioDrt; conflictos: ConflictoEstacionResuelto[]; fueBloqueada: boolean } {
  // 1. Verificar si alguna fue cerrada
  const bloqueoLocal = verificarBloqueoInspeccion(actaLocal);
  const bloqueoRemoto = verificarBloqueoInspeccion(actaRemota);
  const cerrada = bloqueoLocal.bloqueada || bloqueoRemoto.bloqueada;
  const diffActa = compararTimestampsIso(actaLocal.actualizadoEn, actaRemota.actualizadoEn);

  // 2. Fusionar estaciones con LWW
  const fusionEstaciones = fusionarEstacionesLww(
    actaLocal.planillaEstaciones || [],
    actaRemota.planillaEstaciones || [],
  );

  // 3. Fusionar fotos sin pérdida
  const fotosFusionadas = fusionarFotosEvidencia(actaLocal.fotos || [], actaRemota.fotos || []);

  // 4. Firmas: una firma manuscrita válida (archivo local o Base64) nunca se destruye por ausencia remota
  const localTieneFirma = tieneFirmaManuscrita(actaLocal.firmas);
  const remotaTieneFirma = tieneFirmaManuscrita(actaRemota.firmas);
  let firmasFinales = actaLocal.firmas;
  if (!localTieneFirma && remotaTieneFirma) {
    firmasFinales = actaRemota.firmas;
  } else if (localTieneFirma && remotaTieneFirma && diffActa > 0) {
    firmasFinales = actaRemota.firmas;
  } else if (
    !localTieneFirma &&
    !actaLocal.firmas?.responsableNoDisponible &&
    actaRemota.firmas?.responsableNoDisponible
  ) {
    firmasFinales = actaRemota.firmas;
  }

  // 5. Especies de roedores (unión sin duplicados) y contadores (LWW / no destructivo)
  const roedoresFusionados = Array.from(
    new Set([...(actaLocal.roedoresDetectados || []), ...(actaRemota.roedoresDetectados || [])]),
  );

  // 6. Diagnóstico y Observaciones colaborativas (idempotente)
  const observacionesCombinadas = fusionarTextoColaborativo(
    actaLocal.observacionesCliente,
    actaRemota.observacionesCliente,
  );

  const recomendacionesCombinadas = fusionarTextoColaborativo(
    actaLocal.resultadosRecomendaciones,
    actaRemota.resultadosRecomendaciones,
  );

  const actaResultado: ActaServicioDrt = {
    ...actaLocal,
    cebosInstalados: fusionarContador(actaLocal.cebosInstalados, actaRemota.cebosInstalados, diffActa),
    cebosConsumidos: fusionarContador(actaLocal.cebosConsumidos, actaRemota.cebosConsumidos, diffActa),
    cebosRepuestos: fusionarContador(actaLocal.cebosRepuestos, actaRemota.cebosRepuestos, diffActa),
    trampasInstaladas: fusionarContador(actaLocal.trampasInstaladas, actaRemota.trampasInstaladas, diffActa),
    trampasActivadas: fusionarContador(actaLocal.trampasActivadas, actaRemota.trampasActivadas, diffActa),
    roedoresDetectados: roedoresFusionados,
    planillaEstaciones: fusionEstaciones.estaciones,
    fotos: fotosFusionadas,
    firmas: firmasFinales,
    observacionesCliente: observacionesCombinadas,
    resultadosRecomendaciones: recomendacionesCombinadas,
    cerradaEnRevision: cerrada,
    cerradoPor: actaRemota.cerradoPor || actaLocal.cerradoPor,
    actualizadoEn: new Date().toISOString(),
  };

  return {
    acta: actaResultado,
    conflictos: fusionEstaciones.conflictos,
    fueBloqueada: cerrada,
  };
}

/**
 * Formatea la información del técnico y momento de guardado para la vista móvil (fecha y hora en zona local).
 */
export function formatearDetalleBorrador(
  actualizadoEn?: string,
  tecnicoNombre?: string,
): string {
  if (!actualizadoEn) return 'Borrador sin guardar';

  try {
    const fecha = new Date(actualizadoEn);
    if (Number.isNaN(fecha.getTime())) {
      return `Guardado en ${actualizadoEn}`;
    }
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const hours = String(fecha.getHours()).padStart(2, '0');
    const minutes = String(fecha.getMinutes()).padStart(2, '0');
    const fechaStr = `${year}-${month}-${day}`;
    const horaStr = `${hours}:${minutes}`;
    const autor = tecnicoNombre ? ` por ${tecnicoNombre}` : '';
    return `Guardado el ${fechaStr} a las ${horaStr}${autor}`;
  } catch {
    return `Guardado en ${actualizadoEn}`;
  }
}
