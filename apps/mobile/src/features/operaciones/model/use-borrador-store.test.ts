import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useBorradorStore, MENSAJE_ERROR_PERSISTENCIA } from './use-borrador-store';
import { BorradorRepository } from './borrador-repository';
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
    const enDisco = await new BorradorRepository().obtenerPorServicioId('srv-reabrir', 'tec-A');
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
    const enDisco = await new BorradorRepository().obtenerPorServicioId('srv-sesion', 'tec-A');
    expect(enDisco).not.toBeNull();
  });

  it('limpiar elimina el borrador del disco y de la pantalla', async () => {
    await useBorradorStore.getState().iniciarBorrador('srv-fin');

    await useBorradorStore.getState().limpiar();

    expect(useBorradorStore.getState().borrador).toBeNull();
    expect(await new BorradorRepository().obtenerPorServicioId('srv-fin')).toBeNull();
  });

  it('una restauración tardía no sobrescribe un borrador iniciado después (F3)', async () => {
    let resolverLectura!: (valor: { servicioId: string; usuarioId: string; observaciones: string } | null) => void;
    const lecturaPendiente = new Promise<{
      servicioId: string;
      usuarioId: string;
      observaciones: string;
    } | null>((resolve) => {
      resolverLectura = resolve;
    });

    const restauracionEnCurso = useBorradorStore
      .getState()
      .restaurarActivoDeUsuario('tec-A', { obtenerActivo: () => lecturaPendiente });

    // Antes de que resuelva la lectura previa, el técnico inicia otra visita.
    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-nuevo', { usuarioId: 'tec-A' }, 'Trabajo recién iniciado');

    // Ahora llega la respuesta obsoleta de SQLite.
    resolverLectura({
      servicioId: 'srv-viejo',
      usuarioId: 'tec-A',
      observaciones: 'Borrador antiguo',
    });
    await restauracionEnCurso;

    expect(useBorradorStore.getState().borrador?.servicioId).toBe('srv-nuevo');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Trabajo recién iniciado');
  });

  it('dos técnicos pueden trabajar y limpiar el mismo servicioId sin afectar al otro (F2)', async () => {
    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-compartido', { usuarioId: 'tec-A' }, 'Notas A');
    useBorradorStore.getState().descargarDeMemoria();

    await useBorradorStore
      .getState()
      .iniciarBorrador('srv-compartido', { usuarioId: 'tec-B' }, 'Notas B');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe('Notas B');
    await useBorradorStore.getState().limpiar();

    const restauradoA = await useBorradorStore.getState().restaurarActivoDeUsuario('tec-A');
    expect(restauradoA?.observaciones).toBe('Notas A');
    expect(restauradoA?.usuarioId).toBe('tec-A');
  });
});
