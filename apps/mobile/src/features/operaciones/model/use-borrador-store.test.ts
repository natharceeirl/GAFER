import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActaServicioDrt } from '@gafer/contracts';
import { useBorradorStore, MENSAJE_ERROR_PERSISTENCIA } from './use-borrador-store';
import { BorradorRepository } from './borrador-repository';
import { crearFormularioCampo, FormularioCampo } from './formulario-campo';
import { inicializarBaseDeDatos, cerrarBaseDeDatos } from '../../../shared/db/sqlite';

function reiniciarStore() {
  useBorradorStore.setState({ borrador: null, colaEnvioPendiente: false, errorPersistencia: null });
}

describe('useBorradorStore (Mobile)', () => {
  beforeEach(async () => {
    await cerrarBaseDeDatos();
    await inicializarBaseDeDatos();
    reiniciarStore();
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
    reiniciarStore();
  });

  it('inicia un borrador con servicioId y cola en false', async () => {
    const ok = await useBorradorStore.getState().iniciarBorrador('srv-123');
    const state = useBorradorStore.getState();
    expect(ok).toBe(true);
    expect(state.borrador?.servicioId).toBe('srv-123');
    expect(state.colaEnvioPendiente).toBe(false);
  });

  it('actualiza observaciones del borrador activo', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-123');
    const ok = await useBorradorStore.getState().actualizarObservaciones('Sin novedad en cebadero 1');
    expect(ok).toBe(true);
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Sin novedad en cebadero 1');
  });

  it('almacena metadatos legibles (cliente, sede, orden, servicio) en el borrador', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-123', {
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

  it('al reabrir la visita conserva las notas ya escritas (hallazgo 1 del PR #29)', async () => {
    const store = useBorradorStore.getState();
    await store.iniciarBorrador('srv-reabrir', { usuarioId: 'tec-A' }, 'Nota de la programación');
    await useBorradorStore.getState().actualizarObservaciones('Notas del técnico en campo');

    // La app se cierra y el técnico vuelve a tocar la visita.
    reiniciarStore();
    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-reabrir', { usuarioId: 'tec-A' }, 'Nota de la programación');

    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Notas del técnico en campo');
    const enDisco = await new BorradorRepository().obtenerPorServicioId('srv-reabrir');
    expect(enDisco?.observaciones).toBe('Notas del técnico en campo');
  });

  it('si SQLite no está disponible no muestra datos y expone el error (hallazgo 3 del PR #29)', async () => {
    await cerrarBaseDeDatos();

    const ok = await useBorradorStore.getState().iniciarBorrador('srv-sin-db');

    expect(ok).toBe(false);
    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(useBorradorStore.getState().errorPersistencia).toContain(MENSAJE_ERROR_PERSISTENCIA);
  });

  it('si falla el guardado de observaciones la pantalla conserva el último valor guardado', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-falla', undefined, 'Guardado');
    await cerrarBaseDeDatos();

    const ok = await useBorradorStore.getState().actualizarObservaciones('No llegó al disco');

    expect(ok).toBe(false);
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Guardado');
    expect(useBorradorStore.getState().errorPersistencia).not.toBeNull();
  });

  it('descargarDeMemoria quita el borrador de la pantalla pero lo deja en disco', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-sesion', { usuarioId: 'tec-A' });

    useBorradorStore.getState().descargarDeMemoria();

    expect(useBorradorStore.getState().borrador).toBeNull();
    const enDisco = await new BorradorRepository().obtenerPorServicioId('srv-sesion');
    expect(enDisco).not.toBeNull();
  });

  it('limpiar elimina el borrador del disco y de la pantalla', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-fin');

    await useBorradorStore.getState().limpiar();

    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(await new BorradorRepository().obtenerPorServicioId('srv-fin')).toBeNull();
  });


  it('actualiza y almacena el formulario del Acta DRT (GAF-103)', async () => {
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
        responsableNoDisponible: false,
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
        { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 5, repuestoGramos: 5 },
      ],
      fotos: [],
    };

    await useBorradorStore.getState().iniciarBorrador(acta.servicioId, { usuarioId: 'tec-drt' });
    const ok = await useBorradorStore.getState().actualizarDrt(acta);
    expect(ok).toBe(true);
    const estado = useBorradorStore.getState();
    expect(estado.borrador?.servicioId).toBe(acta.servicioId);
    expect(estado.borrador?.datosDrt?.tipoCebo).toBe('BLOQUE_5G');
    expect(estado.borrador?.datosDrt?.planillaEstaciones.length).toBe(2);
    // El upsert del acta conserva al dueño del borrador (hallazgo 5 del PR #29).
    expect(estado.borrador?.usuarioId).toBe('tec-drt');
  });

  it('actualiza y almacena el formulario de campo por bloques (GAF-34)', async () => {
    const f: FormularioCampo = crearFormularioCampo({
      cliente: { razonSocial: 'SAN FERNANDO S.A.' },
      sede: { nombre: 'PLANTA_CHORRILLOS' },
      servicio: {
        id: 'srv-sanfernando-01',
        tipo: 'DESINSECTACION Y DESRATIZACION',
        tipoServicio: 'DSS',
        requiereCertificado: false,
      },
      tecnicoNombre: 'Marco Ipusari',
    });

    f.observacionesLibre = 'Aplicación focalizada en almacén 3.';

    const ok = await useBorradorStore.getState().actualizarCampo(f);
    expect(ok).toBe(true);
    const estado = useBorradorStore.getState();
    expect(estado.borrador?.servicioId).toBe('srv-sanfernando-01');
    expect(estado.borrador?.clienteRazonSocial).toBe('SAN FERNANDO S.A.');
    expect(estado.borrador?.datosCampo?.tipoServicio).toBe('DSS');
    expect(estado.borrador?.datosCampo?.insumos.length).toBeGreaterThan(0);
    expect(estado.borrador?.observaciones).toBe('Aplicación focalizada en almacén 3.');
  });
});
