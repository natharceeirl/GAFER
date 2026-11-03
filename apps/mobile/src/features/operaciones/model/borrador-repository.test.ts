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
    await repo.guardarDrt(acta);
    expect(await repo.obtenerPorServicioId(acta.servicioId)).not.toBeNull();

    // Finalizar servicio en campo
    const { operationId } = await repo.finalizarYEncolarDrt(acta, 'usuario-tecnico-01');
    expect(operationId).toBeDefined();

    // El borrador activo se limpió
    expect(await repo.obtenerPorServicioId(acta.servicioId)).toBeNull();

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
});
