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
      usuarioId: 'tec-nestle',
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
    const borradorRestaurado = await repo.obtenerActivo('tec-nestle');
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

  describe('correcciones de la revisión del PR #29', () => {
    it('guardar sobre un borrador existente conserva observaciones y datos del formulario', async () => {
      await repo.guardar('srv-rev-1', { usuarioId: 'tec-A', sedeNombre: 'PLANTA_1' }, 'Inicial');
      await repo.actualizarObservaciones('srv-rev-1', 'Notas del técnico');
      const db = await inicializarBaseDeDatos();
      await db.runAsync(`UPDATE borradores_inspeccion SET datos_json = ? WHERE servicio_id = ?;`, [
        '{"estaciones":[1,2]}',
        'srv-rev-1',
      ]);

      const reabierto = await repo.guardar('srv-rev-1', { usuarioId: 'tec-A' }, 'Inicial');

      expect(reabierto.observaciones).toBe('Notas del técnico');
      expect(reabierto.sedeNombre).toBe('PLANTA_1');
      const fila = await db.getFirstAsync<{ datos_json: string }>(
        `SELECT datos_json FROM borradores_inspeccion WHERE servicio_id = ?;`,
        ['srv-rev-1'],
      );
      expect(fila?.datos_json).toBe('{"estaciones":[1,2]}');
    });

    it('abrir el borrador y escribir observaciones a la vez no pierde las notas', async () => {
      // Sin await entre ambas: las dos escrituras se lanzan en el mismo tick.
      const apertura = repo.guardar('srv-rev-2', { usuarioId: 'tec-A' });
      const notas = repo.actualizarObservaciones('srv-rev-2', 'Escritas mientras se abría');
      await Promise.all([apertura, notas]);

      const enDisco = await repo.obtenerPorServicioId('srv-rev-2');
      expect(enDisco?.observaciones).toBe('Escritas mientras se abría');
    });

    it('actualizarObservaciones falla si el borrador no existe en disco', async () => {
      await expect(repo.actualizarObservaciones('srv-inexistente', 'x')).rejects.toThrow(
        /no se guardaron/,
      );
    });

    it('obtenerActivo solo devuelve borradores del usuario de la sesión', async () => {
      await repo.guardar('srv-de-A', { usuarioId: 'tec-A', clienteRazonSocial: 'CLIENTE A' }, 'Notas A');
      await repo.guardar('srv-sin-dueno', {}, 'Borrador anterior a la migración v2');

      expect((await repo.obtenerActivo('tec-A'))?.servicioId).toBe('srv-de-A');
      expect(await repo.obtenerActivo('tec-B')).toBeNull();
      expect(await repo.obtenerActivo('')).toBeNull();
    });
  });
});
