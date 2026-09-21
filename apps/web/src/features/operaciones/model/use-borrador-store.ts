import { create } from 'zustand';
import { crearBorradorVacio, type InspeccionBorrador } from './tipos';

interface BorradorStore {
  borrador: InspeccionBorrador | null;
  colaEnvioPendiente: boolean;
  iniciarBorrador: (servicioId: string, inicial?: Partial<InspeccionBorrador>) => void;
  actualizarBloque: <K extends keyof InspeccionBorrador>(bloque: K, valor: InspeccionBorrador[K]) => void;
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
  iniciarBorrador: (servicioId, inicial) =>
    set({ borrador: { ...crearBorradorVacio(servicioId), ...inicial }, colaEnvioPendiente: false }),
  actualizarBloque: (bloque, valor) =>
    set((state) => ({
      borrador: state.borrador ? { ...state.borrador, [bloque]: valor } : state.borrador,
    })),
  marcarComoPendienteDeSincronizar: () => set({ colaEnvioPendiente: true }),
  limpiar: () => set({ borrador: null, colaEnvioPendiente: false }),
}));
