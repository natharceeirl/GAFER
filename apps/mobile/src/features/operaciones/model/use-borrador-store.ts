/**
 * GAFER Mobile — Store de Borrador de Inspección
 * Conectado con BorradorRepository (SQLite) bajo la regla 2.4: "Durable before visible".
 */

import { create } from 'zustand';
import { BorradorRepository } from './borrador-repository';

export interface MetadataBorrador {
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
}

export interface BorradorInspeccion {
  servicioId: string;
  observaciones: string;
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
}

interface BorradorStore {
  borrador: BorradorInspeccion | null;
  colaEnvioPendiente: boolean;
  iniciarBorrador: (servicioId: string, metadata?: MetadataBorrador) => Promise<void>;
  actualizarObservaciones: (observaciones: string) => Promise<void>;
  marcarComoPendienteDeSincronizar: () => void;
  restaurarBorrador: (borrador: BorradorInspeccion | null) => void;
  limpiar: () => Promise<void>;
}

export const useBorradorStore = create<BorradorStore>((set, get) => ({
  borrador: null,
  colaEnvioPendiente: false,

  iniciarBorrador: async (servicioId, metadata) => {
    const nuevoBorrador: BorradorInspeccion = {
      servicioId,
      observaciones: '',
      clienteRazonSocial: metadata?.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre,
      numeroOrden: metadata?.numeroOrden,
      servicioTipo: metadata?.servicioTipo,
    };

    set({
      borrador: nuevoBorrador,
      colaEnvioPendiente: false,
    });

    try {
      const repo = new BorradorRepository();
      await repo.guardar(servicioId, metadata);
    } catch {
      // Base de datos no inicializada o entorno mock
    }
  },

  actualizarObservaciones: async (observaciones) => {
    const actual = get().borrador;
    if (actual) {
      set((state) => ({
        borrador: state.borrador ? { ...state.borrador, observaciones } : state.borrador,
      }));

      try {
        const repo = new BorradorRepository();
        await repo.actualizarObservaciones(actual.servicioId, observaciones);
      } catch {
        // Fallback
      }
    }
  },

  marcarComoPendienteDeSincronizar: () => set({ colaEnvioPendiente: true }),

  restaurarBorrador: (borrador) => set({ borrador, colaEnvioPendiente: false }),

  limpiar: async () => {
    const actual = get().borrador;
    set({ borrador: null, colaEnvioPendiente: false });

    if (actual) {
      try {
        const repo = new BorradorRepository();
        await repo.eliminar(actual.servicioId);
      } catch {
        // Fallback
      }
    }
  },
}));
