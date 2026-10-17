import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
} from '../../../shared/db/sqlite';
import { BorradorRepository } from './borrador-repository';
import { useBorradorStore } from './use-borrador-store';

describe('BorradorRepository & Persistencia SQLite (Criterio GAF-33)', () => {
  let repo: BorradorRepository;

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    const db = await inicializarBaseDeDatos();
    repo = new BorradorRepository(db);
    await repo.limpiarTodos();
    useBorradorStore.getState().restaurarBorrador(null);
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  it('guarda el borrador en SQLite y permite recuperarlo', async () => {
    const metadata = {
      clienteRazonSocial: 'ALICORP S.A.A.',
      sedeNombre: 'PLANTA_CALLAO',
      numeroOrden: 'ORD-2026-001',
      servicioTipo: 'DESINSECTACION',
    };

    await repo.guardar('srv-test-01', metadata, 'Observación inicial de campo');

    const recuperado = await repo.obtenerPorServicioId('srv-test-01');
    expect(recuperado).not.toBeNull();
    expect(recuperado?.servicioId).toBe('srv-test-01');
    expect(recuperado?.clienteRazonSocial).toBe('ALICORP S.A.A.');
    expect(recuperado?.sedeNombre).toBe('PLANTA_CALLAO');
    expect(recuperado?.observaciones).toBe('Observación inicial de campo');
  });

  it('actualiza observaciones de forma durable', async () => {
    await repo.guardar('srv-test-02', { clienteRazonSocial: 'GLORIA S.A.' });
    await repo.actualizarObservaciones('srv-test-02', 'Cebaderos 1 y 2 reemplazados');

    const actualizado = await repo.obtenerPorServicioId('srv-test-02');
    expect(actualizado?.observaciones).toBe('Cebaderos 1 y 2 reemplazados');
  });

  it('cumple con el criterio de éxito: técnico registra datos, se cierra la app, se reabre y no pierde nada', async () => {
    // 1. Técnico inicia inspección y registra observaciones en campo
    await useBorradorStore.getState().iniciarBorrador('srv-persist-99', {
      clienteRazonSocial: 'NESTLE PERU S.A.',
      sedeNombre: 'SEDE_CENTRAL_LIMA',
      numeroOrden: 'ORD-2026-999',
      servicioTipo: 'CONTROL DE ROEDORES',
    });
    await useBorradorStore
      .getState()
      .actualizarObservaciones('Trampa UV #3 con 15 capturas. Requiere recambio de lámina.');

    // 2. Simular cierre abrupto de la app (el estado de React/Zustand se borra de la memoria RAM)
    useBorradorStore.setState({ borrador: null, colaEnvioPendiente: false });
    expect(useBorradorStore.getState().borrador).toBeNull();

    // 3. Simular reapertura de la app: ciclo de arranque lee desde SQLite
    const borradorRestaurado = await repo.obtenerActivo();
    expect(borradorRestaurado).not.toBeNull();
    expect(borradorRestaurado?.servicioId).toBe('srv-persist-99');
    expect(borradorRestaurado?.clienteRazonSocial).toBe('NESTLE PERU S.A.');
    expect(borradorRestaurado?.observaciones).toBe(
      'Trampa UV #3 con 15 capturas. Requiere recambio de lámina.',
    );

    // 4. Restaurar en Zustand para la UI
    useBorradorStore.getState().restaurarBorrador(borradorRestaurado);
    expect(useBorradorStore.getState().borrador?.servicioId).toBe('srv-persist-99');
    expect(useBorradorStore.getState().borrador?.observaciones).toBe(
      'Trampa UV #3 con 15 capturas. Requiere recambio de lámina.',
    );
  });

  it('elimina el borrador de SQLite al limpiar o finalizar', async () => {
    await repo.guardar('srv-test-03');
    await repo.eliminar('srv-test-03');

    const recuperado = await repo.obtenerPorServicioId('srv-test-03');
    expect(recuperado).toBeNull();
  });
});
