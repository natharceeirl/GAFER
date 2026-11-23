/**
 * GAFER Mobile — Store de Borrador de Inspección
 * Conectado con BorradorRepository (SQLite) bajo la regla 2.4: "Durable before visible".
 *
 * Cada acción escribe primero en SQLite y solo después actualiza el estado en memoria.
 * Si la escritura falla, el estado NO cambia y el error queda en `errorPersistencia`
 * para que la pantalla lo muestre: el técnico nunca ve datos que no están en disco.
 */

import { create } from 'zustand';
import { ActaServicioDrt } from '@gafer/contracts';
import { BorradorRepository } from './borrador-repository';
import { ConfigServicioBorrador, FormularioCampo } from './formulario-campo';

export interface MetadataBorrador {
  /** Técnico dueño del borrador en este dispositivo. */
  usuarioId?: string;
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
  tecnicoId?: string;
  tecnicoNombre?: string;
  tecnicoCargo?: string;
  /** Configuración precargada del servicio contratado (§8.2). */
  configServicio?: ConfigServicioBorrador;
}

export interface BorradorInspeccion {
  servicioId: string;
  observaciones: string;
  usuarioId?: string;
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
  configServicio?: ConfigServicioBorrador;
  datosDrt?: ActaServicioDrt;
  datosCampo?: FormularioCampo;
  actualizadoEn?: string;
  guardadoPor?: {
    tecnicoId?: string;
    nombre?: string;
    cargo?: string;
  };
  bloqueada?: boolean;
  motivoBloqueo?: string;
  syncStatus?: string;
}

export const MENSAJE_ERROR_PERSISTENCIA =
  'No se pudo guardar en el almacenamiento del teléfono. Los datos no están a salvo: no cierre la app y avise a soporte.';

interface BorradorStore {
  borrador: BorradorInspeccion | null;
  colaEnvioPendiente: boolean;
  /** Último error al escribir en SQLite; null si la última escritura fue exitosa. */
  errorPersistencia: string | null;
  /** Contador que aumenta solo en fusiones remotas o bloqueos externos para refrescar la UI sin bucles de auto-guardado. */
  revisionRemota: number;
  /**
   * Abre (o reabre) el borrador del servicio. Si ya existía, conserva sus observaciones.
   * Devuelve false si no se pudo guardar en disco.
   */
  iniciarBorrador: (
    servicioId: string,
    metadata?: MetadataBorrador,
    observacionesIniciales?: string,
  ) => Promise<boolean>;
  /** Devuelve false si no hay borrador activo o si no se pudo guardar en disco. */
  actualizarObservaciones: (observaciones: string) => Promise<boolean>;
  /** Guarda el acta DRT en disco y luego la muestra. Devuelve false si no se pudo guardar. */
  actualizarDrt: (acta: ActaServicioDrt, metadata?: MetadataBorrador) => Promise<boolean>;
  /** Guarda el formulario de campo en disco y luego lo muestra. Devuelve false si no se pudo guardar. */
  actualizarCampo: (formulario: FormularioCampo, metadata?: MetadataBorrador) => Promise<boolean>;
  /** Fusiona de forma atómica un acta remota (LWW) en SQLite y refresca el borrador activo en memoria (§8.2). */
  fusionarBorradorRemoto: (
    servicioId: string,
    actaRemota: ActaServicioDrt,
    metadata?: MetadataBorrador,
  ) => Promise<BorradorInspeccion | null>;
  /** Bloquea durablemente la inspección en SQLite y refleja el modo solo lectura en el borrador activo (§8.2). */
  marcarBloqueada: (
    servicioId: string,
    opciones?: string | { usuarioId?: string; cerradoPor?: string; motivo?: string },
  ) => Promise<boolean>;
  finalizarServicioDrt: (
    acta: ActaServicioDrt,
    usuarioId: string,
    opciones?: { encolarEstacionesIndividuales?: boolean },
  ) => Promise<{ operationId: string; estacionesOperacionesIds?: string[] }>;
  finalizarServicioCampo: (formulario: FormularioCampo, usuarioId: string) => Promise<{ operationId: string }>;
  marcarComoPendienteDeSincronizar: () => void;
  restaurarBorrador: (borrador: BorradorInspeccion | null) => void;
  /**
   * Recupera desde SQLite el borrador activo del usuario autenticado y lo carga en memoria.
   * Si mientras se lee disco ocurre una mutación más reciente (p. ej. iniciar otra visita o
   * cerrar sesión), el resultado obsoleto se descarta sin sobrescribir el estado actual.
   */
  restaurarActivoDeUsuario: (
    usuarioId: string,
    repo?: Pick<BorradorRepository, 'obtenerActivo'>,
  ) => Promise<BorradorInspeccion | null>;
  /**
   * Quita el borrador de la pantalla sin borrarlo del disco (al cerrar sesión).
   * El borrador vuelve a aparecer cuando su dueño inicia sesión otra vez.
   */
  descargarDeMemoria: () => void;
  /** Elimina el borrador activo del disco y de la pantalla. */
  limpiar: () => Promise<void>;
  limpiarErrorPersistencia: () => void;
}

function describirError(error: unknown): string {
  const detalle = error instanceof Error ? error.message : String(error);
  return `${MENSAJE_ERROR_PERSISTENCIA} (${detalle})`;
}

let revisionEstado = 0;

export const useBorradorStore = create<BorradorStore>((set, get) => ({
  borrador: null,
  colaEnvioPendiente: false,
  errorPersistencia: null,
  revisionRemota: 0,

  iniciarBorrador: async (servicioId, metadata, observacionesIniciales = '') => {
    revisionEstado += 1;
    try {
      const repo = new BorradorRepository();
      const persistido = await repo.guardar(servicioId, metadata, observacionesIniciales);
      revisionEstado += 1;
      set({ borrador: persistido, colaEnvioPendiente: false, errorPersistencia: null });
      return true;
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return false;
    }
  },

  actualizarObservaciones: async (observaciones) => {
    const actual = get().borrador;
    if (!actual) {
      return false;
    }

    try {
      const repo = new BorradorRepository();
      await repo.actualizarObservaciones(actual.servicioId, observaciones, actual.usuarioId);
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return false;
    }

    revisionEstado += 1;
    set((state) => ({
      // Si mientras se guardaba se cambió de borrador, no se mezclan los datos.
      borrador:
        state.borrador?.servicioId === actual.servicioId &&
        state.borrador?.usuarioId === actual.usuarioId
          ? { ...state.borrador, observaciones }
          : state.borrador,
      errorPersistencia: null,
    }));
    return true;
  },

  actualizarDrt: async (acta, metadata) => {
    const revisionPropia = ++revisionEstado;
    try {
      const repo = new BorradorRepository();
      // El acta pertenece al técnico dueño del borrador activo (clave compuesta servicio+usuario).
      const persistido = await repo.guardarDrt(acta, {
        ...metadata,
        usuarioId: metadata?.usuarioId ?? get().borrador?.usuarioId,
      });
      if (revisionEstado !== revisionPropia) {
        return true;
      }
      set({ borrador: persistido, errorPersistencia: null });
      return true;
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return false;
    }
  },

  actualizarCampo: async (formulario, metadata) => {
    const revisionPropia = ++revisionEstado;
    try {
      const repo = new BorradorRepository();
      // El formulario pertenece al técnico dueño del borrador activo (clave compuesta servicio+usuario).
      const persistido = await repo.guardarCampo(formulario, {
        ...metadata,
        usuarioId: metadata?.usuarioId ?? get().borrador?.usuarioId,
      });
      if (revisionEstado !== revisionPropia) {
        return true;
      }
      set({ borrador: persistido, errorPersistencia: null });
      return true;
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return false;
    }
  },

  fusionarBorradorRemoto: async (servicioId, actaRemota, metadata) => {
    const revisionPropia = ++revisionEstado;
    try {
      const repo = new BorradorRepository();
      const usuarioId = metadata?.usuarioId ?? get().borrador?.usuarioId;
      const fusionado = await repo.fusionarBorradorRemoto(servicioId, actaRemota, {
        ...metadata,
        usuarioId,
      });
      if (revisionEstado !== revisionPropia) {
        return fusionado;
      }
      set((state) => ({
        borrador:
          !state.borrador ||
          (state.borrador.servicioId === servicioId &&
            (state.borrador.usuarioId ?? '') === (usuarioId ?? ''))
            ? fusionado
            : state.borrador,
        errorPersistencia: null,
        revisionRemota: state.revisionRemota + 1,
      }));
      return fusionado;
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return null;
    }
  },

  marcarBloqueada: async (servicioId, opciones) => {
    const revisionPropia = ++revisionEstado;
    try {
      const repo = new BorradorRepository();
      await repo.marcarBloqueada(servicioId, opciones);
      const actual = get().borrador;
      if (!actual || actual.servicioId !== servicioId) {
        return true;
      }
      const actualizado = await repo.obtenerPorServicioId(servicioId, actual.usuarioId);
      if (revisionEstado !== revisionPropia) {
        return true;
      }
      set((state) => ({
        borrador:
          state.borrador?.servicioId === servicioId && actualizado
            ? actualizado
            : state.borrador,
        errorPersistencia: null,
        revisionRemota: state.revisionRemota + 1,
      }));
      return true;
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return false;
    }
  },

  finalizarServicioDrt: async (acta, usuarioId, opciones) => {
    revisionEstado += 1;
    const repo = new BorradorRepository();
    const resultado = await repo.finalizarYEncolarDrt(acta, usuarioId, undefined, opciones);

    revisionEstado += 1;
    set({
      borrador: null,
      colaEnvioPendiente: true,
      errorPersistencia: null,
    });

    return resultado;
  },

  finalizarServicioCampo: async (formulario, usuarioId) => {
    revisionEstado += 1;
    const repo = new BorradorRepository();
    const resultado = await repo.finalizarYEncolarCampo(formulario, usuarioId);

    revisionEstado += 1;
    set({
      borrador: null,
      colaEnvioPendiente: true,
      errorPersistencia: null,
    });

    return resultado;
  },

  marcarComoPendienteDeSincronizar: () => set({ colaEnvioPendiente: true }),

  restaurarBorrador: (borrador) => {
    revisionEstado += 1;
    set({ borrador, colaEnvioPendiente: false });
  },

  restaurarActivoDeUsuario: async (usuarioId, repo) => {
    if (!usuarioId) {
      revisionEstado += 1;
      set({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null });
      return null;
    }

    const revisionPropia = ++revisionEstado;
    const repositorio = repo ?? new BorradorRepository();
    const borradorActivo = await repositorio.obtenerActivo(usuarioId);

    if (revisionEstado !== revisionPropia) {
      return get().borrador;
    }

    set({ borrador: borradorActivo, colaEnvioPendiente: false });
    return borradorActivo;
  },

  descargarDeMemoria: () => {
    revisionEstado += 1;
    set({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null });
  },

  limpiar: async () => {
    const actual = get().borrador;

    if (actual) {
      try {
        const repo = new BorradorRepository();
        await repo.eliminar(actual.servicioId, actual.usuarioId);
      } catch (error) {
        // Se conserva en pantalla: lo que está en disco y lo visible deben coincidir.
        set({ errorPersistencia: describirError(error) });
        return;
      }
    }

    revisionEstado += 1;
    set({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null });
  },

  limpiarErrorPersistencia: () => set({ errorPersistencia: null }),
}));
