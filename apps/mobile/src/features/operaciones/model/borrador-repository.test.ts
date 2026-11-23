import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActaServicioDrt } from '@gafer/contracts';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
} from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { BorradorRepository } from './borrador-repository';
import { useBorradorStore } from './use-borrador-store';

describe('BorradorRepository & Persistencia SQLite (Criterio GAF-33 & GAF-103)', () => {
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

  it('guarda de forma durable el formulario completo del Acta de Servicio DRT (GAF-103)', async () => {
    const acta: ActaServicioDrt = {
      servicioId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      clienteRazonSocial: 'MOLITALIA S.A.',
      sedeDireccion: 'Av. Venezuela 2450, Lima',
      fecha: '2026-11-03',
      areaTratadaM2: 800,
      horaInicio: '08:00',
      horaTermino: '10:30',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 40,
      cebosConsumidos: 8,
      cebosRepuestos: 8,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 15,
      trampasActivadas: 2,
      roedoresDetectados: ['R_NORVEGICUS'],
      resultadosRecomendaciones: 'Cebaderos perimetrales inspeccionados sin novedades mayores.',
      observacionesCliente: 'Recibido conforme.',
      firmas: {
        personalResponsableNombre: 'Mario Silva',
        personalResponsableCargo: 'Técnico Especialista',
        clienteConformidadNombre: 'Jorge Ramirez',
        clienteConformidadCargo: 'Supervisor de Planta',
        fecha: '2026-11-03',
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
        { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 10, repuestoGramos: 10 },
        { numero: 3, estado: 'SIN_ACCESO', observaciones: 'Almacén cerrado' },
        { numero: 4, estado: 'EXTRAVIADA', observaciones: 'No se ubicó punto de control' },
      ],
    };

    await repo.guardarDrt(acta);

    const recuperado = await repo.obtenerPorServicioId(acta.servicioId);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.datosDrt).toBeDefined();
    expect(recuperado?.datosDrt?.tipoCebo).toBe('BLOQUE_10G');
    expect(recuperado?.datosDrt?.planillaEstaciones.length).toBe(4);
    expect(recuperado?.datosDrt?.planillaEstaciones[2].estado).toBe('SIN_ACCESO');
    expect(recuperado?.datosDrt?.planillaEstaciones[3].estado).toBe('EXTRAVIADA');
  });

  it('finaliza el servicio DRT y encola la operacion en sync_outbox durablemente (GAF-103)', async () => {
    const acta: ActaServicioDrt = {
      servicioId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
      clienteRazonSocial: 'SAN FERNANDO S.A.',
      sedeDireccion: 'Carretera Central Km 18',
      fecha: '2026-11-03',
      areaTratadaM2: 1500,
      horaInicio: '09:00',
      horaTermino: '12:00',
      actividad: 'EVALUACION',
      tipoCebo: 'PASTA',
      cebosInstalados: 60,
      cebosConsumidos: 0,
      cebosRepuestos: 0,
      tipoTrampa: 'NINGUNA',
      trampasInstaladas: 0,
      trampasActivadas: 0,
      roedoresDetectados: [],
      resultadosRecomendaciones: 'Instalación inicial de cebaderas completada.',
      observacionesCliente: 'Todo en orden.',
      firmas: {
        personalResponsableNombre: 'Ana Torres',
        personalResponsableCargo: 'Técnico Operador',
        clienteConformidadNombre: 'Luis Mendoza',
        clienteConformidadCargo: 'Encargado de Seguridad',
        fecha: '2026-11-03',
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
      ],
    };

    // Primero existe como borrador en curso
    await repo.guardarDrt(acta, { usuarioId: 'usuario-tecnico-01' });
    expect(await repo.obtenerPorServicioId(acta.servicioId, 'usuario-tecnico-01')).not.toBeNull();

    // Finalizar servicio en campo
    const { operationId } = await repo.finalizarYEncolarDrt(acta, 'usuario-tecnico-01');
    expect(operationId).toBeDefined();

    // El borrador activo se limpió
    expect(await repo.obtenerPorServicioId(acta.servicioId, 'usuario-tecnico-01')).toBeNull();

    // La operación se encuentra en la cola Outbox de SQLite
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes.length).toBe(1);
    expect(pendientes[0].operacion.operationId).toBe(operationId);
    expect(pendientes[0].operacion.tipo).toBe('REGISTRO_SERVICIO_DRT');
    expect(pendientes[0].operacion.agregadoId).toBe(acta.servicioId);
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
      await repo.actualizarObservaciones('srv-rev-1', 'Notas del técnico', 'tec-A');
      const db = await inicializarBaseDeDatos();
      await db.runAsync(
        `UPDATE borradores_inspeccion SET datos_json = ? WHERE servicio_id = ? AND usuario_id = ?;`,
        ['{"estaciones":[1,2]}', 'srv-rev-1', 'tec-A'],
      );

      const reabierto = await repo.guardar('srv-rev-1', { usuarioId: 'tec-A' }, 'Inicial');

      expect(reabierto.observaciones).toBe('Notas del técnico');
      expect(reabierto.sedeNombre).toBe('PLANTA_1');
      const fila = await db.getFirstAsync<{ datos_json: string }>(
        `SELECT datos_json FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        ['srv-rev-1', 'tec-A'],
      );
      expect(fila?.datos_json).toBe('{"estaciones":[1,2]}');
    });

    it('abrir el borrador y escribir observaciones a la vez no pierde las notas', async () => {
      // Sin await entre ambas: las dos escrituras se lanzan en el mismo tick.
      const apertura = repo.guardar('srv-rev-2', { usuarioId: 'tec-A' });
      const notas = repo.actualizarObservaciones('srv-rev-2', 'Escritas mientras se abría', 'tec-A');
      await Promise.all([apertura, notas]);

      const enDisco = await repo.obtenerPorServicioId('srv-rev-2', 'tec-A');
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

    it('aisla borradores de dos técnicos sobre el mismo servicio_id en celular compartido (F2)', async () => {
      await repo.guardar(
        'srv-c12-compartido',
        { usuarioId: 'tec-A', clienteRazonSocial: 'GRUPO GLORIA S.A.' },
        'Inicial A',
      );
      await repo.actualizarObservaciones('srv-c12-compartido', 'Notas confidenciales de A', 'tec-A');
      const db = await inicializarBaseDeDatos();
      await db.runAsync(
        `UPDATE borradores_inspeccion SET datos_json = ? WHERE servicio_id = ? AND usuario_id = ?;`,
        ['{"estaciones":[10,20]}', 'srv-c12-compartido', 'tec-A'],
      );

      // Técnico B abre la misma visita C12 en el mismo dispositivo: no debe robar ni ver datos de A.
      const borradorB = await repo.guardar(
        'srv-c12-compartido',
        { usuarioId: 'tec-B', clienteRazonSocial: 'GRUPO GLORIA S.A.' },
        'Inicial B',
      );

      expect(borradorB.usuarioId).toBe('tec-B');
      expect(borradorB.observaciones).toBe('Inicial B');

      const filaB = await db.getFirstAsync<{ datos_json: string | null }>(
        `SELECT datos_json FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        ['srv-c12-compartido', 'tec-B'],
      );
      expect(filaB?.datos_json).toBeNull();

      // El borrador de A sigue intacto y pertenece a A.
      const activoA = await repo.obtenerActivo('tec-A');
      expect(activoA?.usuarioId).toBe('tec-A');
      expect(activoA?.observaciones).toBe('Notas confidenciales de A');
      const filaA = await db.getFirstAsync<{ datos_json: string | null }>(
        `SELECT datos_json FROM borradores_inspeccion WHERE servicio_id = ? AND usuario_id = ?;`,
        ['srv-c12-compartido', 'tec-A'],
      );
      expect(filaA?.datos_json).toBe('{"estaciones":[10,20]}');

      // Mutar o eliminar el borrador de B no afecta el de A.
      await repo.actualizarObservaciones('srv-c12-compartido', 'Notas editadas por B', 'tec-B');
      await repo.eliminar('srv-c12-compartido', 'tec-B');

      expect(await repo.obtenerActivo('tec-B')).toBeNull();
      expect((await repo.obtenerActivo('tec-A'))?.observaciones).toBe('Notas confidenciales de A');
    });
  });
});
