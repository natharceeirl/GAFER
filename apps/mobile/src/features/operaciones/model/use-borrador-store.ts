import { create } from 'zustand';

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
  iniciarBorrador: (servicioId: string, metadata?: MetadataBorrador) => void;
  actualizarObservaciones: (observaciones: string) => void;
  marcarComoPendienteDeSincronizar: () => void;
  limpiar: () => void;
}

export const useBorradorStore = create<BorradorStore>((set) => ({
  borrador: null,
  colaEnvioPendiente: false,
  iniciarBorrador: (servicioId, metadata) =>
    set({
      borrador: {
        servicioId,
        observaciones: '',
        clienteRazonSocial: metadata?.clienteRazonSocial,
        sedeNombre: metadata?.sedeNombre,
        numeroOrden: metadata?.numeroOrden,
        servicioTipo: metadata?.servicioTipo,
      },
      colaEnvioPendiente: false,
    }),
  actualizarObservaciones: (observaciones) =>
    set((state) => ({
      borrador: state.borrador ? { ...state.borrador, observaciones } : state.borrador,
    })),
  marcarComoPendienteDeSincronizar: () => set({ colaEnvioPendiente: true }),
  limpiar: () => set({ borrador: null, colaEnvioPendiente: false }),
}));
