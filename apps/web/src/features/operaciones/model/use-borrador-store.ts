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

/**
 * Store LOCAL (borrador + cola de sync offline, IndexedDB en producción).
 * Deliberadamente separado del cache de servidor (ver ../api/use-inspeccion-query.ts):
 * mezclar ambos fue señalado como el bug más difícil de reproducir de
 * todo el sistema — no se sabría si un dato en pantalla es local sin
 * sincronizar o ya confirmado por el backend.
 */
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
