import { describe, it, expect, beforeEach } from 'vitest';
import { ActaServicioDrt } from '@gafer/contracts';
import { useBorradorStore } from './use-borrador-store';

describe('useBorradorStore (Mobile)', () => {
  beforeEach(() => {
    useBorradorStore.getState().limpiar();
  });

  it('inicia un borrador con servicioId y cola en false', () => {
    useBorradorStore.getState().iniciarBorrador('srv-123');
    const state = useBorradorStore.getState();
    expect(state.borrador?.servicioId).toBe('srv-123');
    expect(state.colaEnvioPendiente).toBe(false);
  });

  it('actualiza observaciones del borrador activo', () => {
    useBorradorStore.getState().iniciarBorrador('srv-123');
    useBorradorStore.getState().actualizarObservaciones('Sin novedad en cebadero 1');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Sin novedad en cebadero 1');
  });

  it('almacena metadatos legibles (cliente, sede, orden, servicio) en el borrador', () => {
    useBorradorStore.getState().iniciarBorrador('srv-123', {
      clienteRazonSocial: 'ALICORP S.A.A.',
      sedeNombre: 'PLANTA_CALLAO',
      numeroOrden: 'ORD-2026-001',
      servicioTipo: 'DESINSECTACION',
    });
    const borrador = useBorradorStore.getState().borrador;
    expect(borrador?.clienteRazonSocial).toBe('ALICORP S.A.A.');
    expect(borrador?.sedeNombre).toBe('PLANTA_CALLAO');
    expect(borrador?.numeroOrden).toBe('ORD-2026-001');
    expect(borrador?.servicioTipo).toBe('DESINSECTACION');
  });

  it('actualiza y almacena el formulario del Acta DRT (GAF-103)', () => {
    const acta: ActaServicioDrt = {
      servicioId: 'f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
      clienteRazonSocial: 'BACKUS & JOHNSTON',
      sedeDireccion: 'Planta Ate',
      fecha: '2026-11-03',
      horaInicio: '08:00',
      horaTermino: '10:00',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_5G',
      cebosInstalados: 20,
      cebosConsumidos: 5,
      cebosRepuestos: 5,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 10,
      trampasActivadas: 1,
      roedoresDetectados: ['MUS_MUSCULUS'],
      resultadosRecomendaciones: 'Monitoreo mensual sin incidencias críticas.',
      observacionesCliente: 'Conforme.',
      firmas: {
        personalResponsableNombre: 'Carlos Prado',
        personalResponsableCargo: 'Técnico Especialista',
        clienteConformidadNombre: 'Ana Rivas',
        clienteConformidadCargo: 'Jefa de Calidad',
        fecha: '2026-11-03',
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
        { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 5, repuestoGramos: 5 },
      ],
    };

    useBorradorStore.getState().actualizarDrt(acta);
    const estado = useBorradorStore.getState();
    expect(estado.borrador?.servicioId).toBe(acta.servicioId);
    expect(estado.borrador?.datosDrt?.tipoCebo).toBe('BLOQUE_5G');
    expect(estado.borrador?.datosDrt?.planillaEstaciones.length).toBe(2);
  });
});
