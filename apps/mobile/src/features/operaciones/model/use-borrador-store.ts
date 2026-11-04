/**
 * GAFER Mobile — Store de Borrador de Inspección
 * Conectado con BorradorRepository (SQLite) bajo la regla 2.4: "Durable before visible".
 */

import { create } from 'zustand';
import { ActaServicioDrt } from '@gafer/contracts';
import { BorradorRepository } from './borrador-repository';
import { FormularioCampo } from './formulario-campo';

export interface MetadataBorrador {
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
  tecnicoId?: string;
  tecnicoNombre?: string;
  tecnicoCargo?: string;
}

export interface BorradorInspeccion {
  servicioId: string;
  observaciones: string;
  clienteRazonSocial?: string;
  sedeNombre?: string;
  numeroOrden?: string;
  servicioTipo?: string;
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

interface BorradorStore {
  borrador: BorradorInspeccion | null;
  colaEnvioPendiente: boolean;
  iniciarBorrador: (servicioId: string, metadata?: MetadataBorrador) => Promise<void>;
  actualizarObservaciones: (observaciones: string) => Promise<void>;
  actualizarDrt: (acta: ActaServicioDrt, metadata?: MetadataBorrador) => Promise<void>;
  actualizarCampo: (formulario: FormularioCampo, metadata?: MetadataBorrador) => Promise<void>;
  finalizarServicioDrt: (
    acta: ActaServicioDrt,
    usuarioId: string,
    opciones?: { encolarEstacionesIndividuales?: boolean },
  ) => Promise<{ operationId: string; estacionesOperacionesIds?: string[] }>;
  finalizarServicioCampo: (formulario: FormularioCampo, usuarioId: string) => Promise<{ operationId: string }>;
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

  actualizarDrt: async (acta, metadata) => {
    const actual = get().borrador;
    const ahora = new Date().toISOString();
    const nuevoBorrador: BorradorInspeccion = {
      servicioId: acta.servicioId,
      observaciones: acta.resultadosRecomendaciones || (actual?.observaciones ?? ''),
      clienteRazonSocial: metadata?.clienteRazonSocial ?? actual?.clienteRazonSocial ?? acta.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre ?? actual?.sedeNombre ?? acta.sedeDireccion,
      numeroOrden: metadata?.numeroOrden ?? actual?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? actual?.servicioTipo ?? 'DESRATIZACION_DRT',
      datosDrt: {
        ...acta,
        actualizadoEn: ahora,
        actualizadoPor: metadata?.tecnicoNombre ?? acta.actualizadoPor ?? acta.firmas?.personalResponsableNombre,
      },
      datosCampo: actual?.datosCampo,
      actualizadoEn: ahora,
      guardadoPor: {
        tecnicoId: metadata?.tecnicoId,
        nombre: metadata?.tecnicoNombre ?? acta.firmas?.personalResponsableNombre,
        cargo: metadata?.tecnicoCargo ?? acta.firmas?.personalResponsableCargo,
      },
      bloqueada: !!acta.cerradaEnRevision,
      motivoBloqueo: acta.cerradaEnRevision
        ? 'La inspección está cerrada y no acepta más sincronizaciones de campo (Sección 8.2)'
        : undefined,
    };

    set({
      borrador: nuevoBorrador,
    });

    try {
      const repo = new BorradorRepository();
      await repo.guardarDrt(nuevoBorrador.datosDrt!, metadata);
    } catch {
      // Fallback
    }
  },

  actualizarCampo: async (formulario, metadata) => {
    const actual = get().borrador;
    const observacionesTexto =
      formulario.observacionesLibre ||
      (formulario.observaciones.length > 0 ? formulario.observaciones.join('. ') : (actual?.observaciones ?? ''));

    const nuevoBorrador: BorradorInspeccion = {
      servicioId: formulario.servicioId,
      observaciones: observacionesTexto,
      clienteRazonSocial: metadata?.clienteRazonSocial ?? formulario.clienteRazon ?? actual?.clienteRazonSocial,
      sedeNombre: metadata?.sedeNombre ?? formulario.proyectoNombre ?? actual?.sedeNombre,
      numeroOrden: metadata?.numeroOrden ?? actual?.numeroOrden,
      servicioTipo: metadata?.servicioTipo ?? formulario.servicioEtiqueta ?? actual?.servicioTipo,
      datosCampo: formulario,
      datosDrt: actual?.datosDrt,
    };

    set({
      borrador: nuevoBorrador,
    });

    try {
      const repo = new BorradorRepository();
      await repo.guardarCampo(formulario, metadata);
    } catch {
      // Fallback
    }
  },

  finalizarServicioDrt: async (acta, usuarioId, opciones) => {
    const repo = new BorradorRepository();
    const resultado = await repo.finalizarYEncolarDrt(acta, usuarioId, undefined, opciones);

    set({
      borrador: null,
      colaEnvioPendiente: true,
    });

    return resultado;
  },

  finalizarServicioCampo: async (formulario, usuarioId) => {
    const repo = new BorradorRepository();
    const resultado = await repo.finalizarYEncolarCampo(formulario, usuarioId);

    set({
      borrador: null,
      colaEnvioPendiente: true,
    });

    return resultado;
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
