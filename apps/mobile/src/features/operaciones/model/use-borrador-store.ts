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

export interface MetadataBorrador {
  /** Técnico dueño del borrador en este dispositivo. */
  usuarioId?: string;
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
}

export interface BorradorInspeccion {
  servicioId: string;
  observaciones: string;
  usuarioId?: string;
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
  datosDrt?: ActaServicioDrt;
}

export const MENSAJE_ERROR_PERSISTENCIA =
  'No se pudo guardar en el almacenamiento del teléfono. Los datos no están a salvo: no cierre la app y avise a soporte.';

interface BorradorStore {
  borrador: BorradorInspeccion | null;
  colaEnvioPendiente: boolean;
  /** Último error al escribir en SQLite; null si la última escritura fue exitosa. */
  errorPersistencia: string | null;
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
  finalizarServicioDrt: (acta: ActaServicioDrt, usuarioId: string) => Promise<{ operationId: string }>;
  marcarComoPendienteDeSincronizar: () => void;
  restaurarBorrador: (borrador: BorradorInspeccion | null) => void;
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

export const useBorradorStore = create<BorradorStore>((set, get) => ({
  borrador: null,
  colaEnvioPendiente: false,
  errorPersistencia: null,

  iniciarBorrador: async (servicioId, metadata, observacionesIniciales = '') => {
    try {
      const repo = new BorradorRepository();
      const persistido = await repo.guardar(servicioId, metadata, observacionesIniciales);
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
      await repo.actualizarObservaciones(actual.servicioId, observaciones);
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return false;
    }

    set((state) => ({
      // Si mientras se guardaba se cambió de borrador, no se mezclan los datos.
      borrador:
        state.borrador?.servicioId === actual.servicioId
          ? { ...state.borrador, observaciones }
          : state.borrador,
      errorPersistencia: null,
    }));
    return true;
  },

  actualizarDrt: async (acta, metadata) => {
    try {
      const repo = new BorradorRepository();
      const persistido = await repo.guardarDrt(acta, metadata);
      set({ borrador: persistido, errorPersistencia: null });
      return true;
    } catch (error) {
      set({ errorPersistencia: describirError(error) });
      return false;
    }
  },

  finalizarServicioDrt: async (acta, usuarioId) => {
    const repo = new BorradorRepository();
    const resultado = await repo.finalizarYEncolarDrt(acta, usuarioId);

    set({
      borrador: null,
      colaEnvioPendiente: true,
    });

    return resultado;
  },

  marcarComoPendienteDeSincronizar: () => set({ colaEnvioPendiente: true }),

  restaurarBorrador: (borrador) => set({ borrador, colaEnvioPendiente: false }),

  descargarDeMemoria: () =>
    set({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null }),

  limpiar: async () => {
    const actual = get().borrador;

    if (actual) {
      try {
        const repo = new BorradorRepository();
        await repo.eliminar(actual.servicioId);
      } catch (error) {
        // Se conserva en pantalla: lo que está en disco y lo visible deben coincidir.
        set({ errorPersistencia: describirError(error) });
        return;
      }
    }

    set({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null });
  },

  limpiarErrorPersistencia: () => set({ errorPersistencia: null }),
}));
