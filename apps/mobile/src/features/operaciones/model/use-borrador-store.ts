import { create } from 'zustand';

interface BorradorInspeccion {
  servicioId: string;
  observaciones: string;
}

interface BorradorStore {
  borrador: BorradorInspeccion | null;
  colaEnvioPendiente: boolean;
  iniciarBorrador: (servicioId: string) => void;
  actualizarObservaciones: (observaciones: string) => void;
  marcarComoPendienteDeSincronizar: () => void;
  limpiar: () => void;
}

export const useBorradorStore = create<BorradorStore>((set) => ({
  borrador: null,
  colaEnvioPendiente: false,
  iniciarBorrador: (servicioId) =>
    set({ borrador: { servicioId, observaciones: '' }, colaEnvioPendiente: false }),
  actualizarObservaciones: (observaciones) =>
    set((state) => ({
      borrador: state.borrador ? { ...state.borrador, observaciones } : state.borrador,
    })),
  marcarComoPendienteDeSincronizar: () => set({ colaEnvioPendiente: true }),
  limpiar: () => set({ borrador: null, colaEnvioPendiente: false }),
}));
