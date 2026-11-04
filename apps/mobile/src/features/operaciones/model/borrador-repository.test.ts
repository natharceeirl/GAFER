import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActaServicioDrt } from '@gafer/contracts';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
} from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { BorradorRepository } from './borrador-repository';
import { useBorradorStore } from './use-borrador-store';
import {
  crearFormularioCampo,
  FormularioCampo,
  INSUMOS_CATALOGO_SEMILLA,
  EQUIPOS_CATALOGO_SEMILLA,
} from './formulario-campo';

describe('BorradorRepository & Persistencia SQLite (Criterio GAF-33, GAF-103 & GAF-34)', () => {
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
        responsableNoDisponible: false,
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
        { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 10, repuestoGramos: 10 },
        { numero: 3, estado: 'SIN_ACCESO', observaciones: 'Almacén cerrado' },
        { numero: 4, estado: 'EXTRAVIADA', observaciones: 'No se ubicó punto de control' },
      ],
      fotos: [],
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

  it('guarda de forma durable el formulario de campo por bloques con insumos y equipos (GAF-34)', async () => {
    const f: FormularioCampo = crearFormularioCampo({
      cliente: { id: 'c1', razonSocial: 'LAIVE S.A.' },
      sede: { id: 'p1', nombre: 'PLANTA_ATE' },
      servicio: {
        id: 'srv-laive-01',
        tipo: 'DESINSECTACION Y DESINFECCION',
        tipoServicio: 'DSS',
        insumosAutorizados: [
          {
            insumoId: INSUMOS_CATALOGO_SEMILLA[0].id,
            nombreComercial: INSUMOS_CATALOGO_SEMILLA[0].nombreComercial,
            dosisReferencial: '10 ml por litro de agua',
          },
        ],
        equiposAutorizados: [EQUIPOS_CATALOGO_SEMILLA[0].id],
      },
      tecnicoNombre: 'Rosa Agárate',
    });

    f.insumos[0].lote = 'L-LAIVE-2026';
    f.insumos[0].vencimiento = '2027-05-20';
    f.insumos[0].cantidad = '15';
    f.insumos[0].unidad = 'l';
    f.insumos[0].zonas = 'Área de pasteurizado';
    f.observacionesLibre = 'Aplicación realizada sin interrupciones.';

    await repo.guardarCampo(f);

    const recuperado = await repo.obtenerPorServicioId(f.servicioId);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.datosCampo).toBeDefined();
    expect(recuperado?.clienteRazonSocial).toBe('LAIVE S.A.');
    expect(recuperado?.sedeNombre).toBe('PLANTA_ATE');
    expect(recuperado?.datosCampo?.insumos[0].lote).toBe('L-LAIVE-2026');
    expect(recuperado?.datosCampo?.insumos[0].dosisReferencial).toBe('10 ml por litro de agua');
    expect(recuperado?.datosCampo?.equipos).toContain(EQUIPOS_CATALOGO_SEMILLA[0].id);
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
        responsableNoDisponible: false,
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
      ],
      fotos: [],
    };

    await repo.guardarDrt(acta);
    expect(await repo.obtenerPorServicioId(acta.servicioId)).not.toBeNull();

    const { operationId } = await repo.finalizarYEncolarDrt(acta, 'usuario-tecnico-01');
    expect(operationId).toBeDefined();

    expect(await repo.obtenerPorServicioId(acta.servicioId)).toBeNull();

    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes.length).toBe(1);
    expect(pendientes[0].operacion.operationId).toBe(operationId);
    expect(pendientes[0].operacion.tipo).toBe('REGISTRO_SERVICIO_DRT');
    expect(pendientes[0].operacion.agregadoId).toBe(acta.servicioId);
  });

  it('finaliza el servicio de campo por bloques y encola la operacion en sync_outbox (GAF-34)', async () => {
    const f: FormularioCampo = crearFormularioCampo({
      cliente: { id: 'c2', razonSocial: 'GLORIA S.A.' },
      sede: { id: 'p2', nombre: 'PLANTA_HUACHIPA' },
      servicio: {
        id: 'srv-gloria-01',
        tipo: 'DESINFECCION AMBIENTAL',
        tipoServicio: 'DSF',
        requiereCertificado: false,
        insumosAutorizados: [
          {
            insumoId: INSUMOS_CATALOGO_SEMILLA[5].id,
            nombreComercial: INSUMOS_CATALOGO_SEMILLA[5].nombreComercial,
            dosisReferencial: '5 ml por litro de agua',
          },
        ],
        equiposAutorizados: [EQUIPOS_CATALOGO_SEMILLA[1].id],
      },
      tecnicoNombre: 'Marco Ipusari',
    });

    f.metodos = ['Nebulización'];
    f.insumos[0].aplicado = true;
    f.insumos[0].lote = 'L-GLORIA-001';
    f.insumos[0].vencimiento = '2027-10-01';
    f.insumos[0].cantidad = '50';
    f.insumos[0].unidad = 'l';
    f.insumos[0].zonas = 'Nave industrial 1 y 2';
    f.temperatura = '20';
    f.humedad = '70';
    f.viento = '10';
    f.estadoGeneral = 'Bueno';
    f.nivelInfestacion = 'Nulo';
    f.responsableNoDisponible = true; // No requiere firma física
    f.observacionesLibre = 'Servicio culminado conforme.';

    await repo.guardarCampo(f);
    expect(await repo.obtenerPorServicioId(f.servicioId)).not.toBeNull();

    const { operationId } = await repo.finalizarYEncolarCampo(f, 'tecnico-marco-id');
    expect(operationId).toBeDefined();

    // El borrador activo se limpió
    expect(await repo.obtenerPorServicioId(f.servicioId)).toBeNull();

    // La operación se encuentra en la cola Outbox
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes.length).toBe(1);
    expect(pendientes[0].operacion.operationId).toBe(operationId);
    expect(pendientes[0].operacion.tipo).toBe('REGISTRO_SERVICIO_CAMPO');
    expect(pendientes[0].operacion.agregadoId).toBe(f.servicioId);
  });

  it('elimina el borrador de SQLite al limpiar o finalizar', async () => {
    await repo.guardar('srv-test-03');
    await repo.eliminar('srv-test-03');

    const recuperado = await repo.obtenerPorServicioId('srv-test-03');
    expect(recuperado).toBeNull();
  });
});
