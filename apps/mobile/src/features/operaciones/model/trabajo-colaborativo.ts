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
  if (acta.cerradaEnRevision || acta.bloqueada || acta.estado === 'CERRADO' || acta.estado === 'EN_REVISION') {
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
 * - Fusión no destructiva de firmas y observaciones.
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

  // 2. Fusionar estaciones con LWW
  const fusionEstaciones = fusionarEstacionesLww(
    actaLocal.planillaEstaciones || [],
    actaRemota.planillaEstaciones || [],
  );

  // 3. Fusionar fotos sin pérdida
  const fotosFusionadas = fusionarFotosEvidencia(actaLocal.fotos || [], actaRemota.fotos || []);

  // 4. Firmas: priorizar la que contenga firma manuscrita o datos válidos
  let firmasFinales = actaLocal.firmas;
  if (!firmasFinales.firmaDigitalBase64 && actaRemota.firmas?.firmaDigitalBase64) {
    firmasFinales = actaRemota.firmas;
  } else if (!firmasFinales.responsableNoDisponible && actaRemota.firmas?.responsableNoDisponible) {
    firmasFinales = actaRemota.firmas;
  }

  // 5. Diagnóstico y Observaciones colaborativas
  const observacionesCombinadas = Array.from(
    new Set(
      [actaLocal.observacionesCliente, actaRemota.observacionesCliente].filter(Boolean),
    ),
  ).join(' | ');

  const recomendacionesCombinadas = Array.from(
    new Set(
      [actaLocal.resultadosRecomendaciones, actaRemota.resultadosRecomendaciones].filter(Boolean),
    ),
  ).join(' | ');

  const actaResultado: ActaServicioDrt = {
    ...actaLocal,
    planillaEstaciones: fusionEstaciones.estaciones,
    fotos: fotosFusionadas,
    firmas: firmasFinales,
    observacionesCliente: observacionesCombinadas || actaLocal.observacionesCliente,
    resultadosRecomendaciones: recomendacionesCombinadas || actaLocal.resultadosRecomendaciones,
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
 * Formatea la información del técnico y momento de guardado para la vista móvil.
 */
export function formatearDetalleBorrador(
  actualizadoEn?: string,
  tecnicoNombre?: string,
): string {
  if (!actualizadoEn) return 'Borrador sin guardar';

  try {
    const fecha = new Date(actualizadoEn);
    const fechaStr = fecha.toISOString().slice(0, 10);
    const horaStr = fecha.toTimeString().slice(0, 5);
    const autor = tecnicoNombre ? ` por ${tecnicoNombre}` : '';
    return `Guardado el ${fechaStr} a las ${horaStr}${autor}`;
  } catch {
    return `Guardado en ${actualizadoEn}`;
  }
}
