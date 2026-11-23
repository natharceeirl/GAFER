import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActaServicioDrt, OperacionSyncSchema } from '@gafer/contracts';
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
        firmaDigitalBase64: 'data:image/svg+xml;base64,PHN2Zz48cGF0aCBkPSJNIDAgMCBMIDEwIDEwIi8+PC9zdmc+',
      },
      planillaEstaciones: [
        { numero: 1, estado: 'SIN_ACTIVIDAD' },
      ],
      fotos: [],
    };

    const usuarioUuid = '33333333-3333-4000-8000-000000000001';

    // Primero existe como borrador en curso
    await repo.guardarDrt(acta, { usuarioId: usuarioUuid });
    expect(await repo.obtenerPorServicioId(acta.servicioId, usuarioUuid)).not.toBeNull();

    // Finalizar servicio en campo
    const { operationId } = await repo.finalizarYEncolarDrt(acta, usuarioUuid);
    expect(operationId).toBeDefined();

    // El borrador activo se limpió
    expect(await repo.obtenerPorServicioId(acta.servicioId, usuarioUuid)).toBeNull();

    // La operación se encuentra en la cola Outbox de SQLite y cumple OperacionSyncSchema
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes.length).toBe(1);
    expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
    expect(pendientes[0].operacion.operationId).toBe(operationId);
    expect(pendientes[0].operacion.tipo).toBe('REGISTRO_SERVICIO_DRT');
    expect(pendientes[0].operacion.agregadoId).toBe(acta.servicioId);
    expect(pendientes[0].operacion.actorId).toBe(usuarioUuid);
  });

  it('rechaza finalizarYEncolarDrt cuando usuarioId no es UUID y conserva el borrador sin contaminar sync_outbox (F5)', async () => {
    const acta: ActaServicioDrt = {
      servicioId: 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f',
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
      resultadosRecomendaciones: 'Instalación inicial.',
      observacionesCliente: 'Conforme.',
      firmas: {
        personalResponsableNombre: 'Ana Torres',
        personalResponsableCargo: 'Técnico Operador',
        clienteConformidadNombre: 'Luis Mendoza',
        clienteConformidadCargo: 'Encargado de Seguridad',
        fecha: '2026-11-03',
        responsableNoDisponible: false,
        firmaDigitalBase64: 'data:image/svg+xml;base64,PHN2Zz48cGF0aCBkPSJNIDAgMCBMIDEwIDEwIi8+PC9zdmc+',
      },
      planillaEstaciones: [{ numero: 1, estado: 'SIN_ACTIVIDAD' }],
      fotos: [],
    };

    await repo.guardarDrt(acta, { usuarioId: 'tecnico-local-01' });

    await expect(
      repo.finalizarYEncolarDrt(acta, 'tecnico-local-01', undefined, {
        encolarEstacionesIndividuales: true,
      }),
    ).rejects.toThrow();

    // El borrador no fue eliminado y sync_outbox no recibió una operación inválida
    expect(await repo.obtenerPorServicioId(acta.servicioId, 'tecnico-local-01')).not.toBeNull();
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    expect(outbox.obtenerPendientes()).toHaveLength(0);
  });

  it('al encolar estaciones individuales alinea huboConsumo con colorIcono y no deriva colorAura de estadoFisico (PR35-F3)', async () => {
    const usuarioUuid = '33333333-3333-4000-8000-000000000010';
    const acta: ActaServicioDrt = {
      servicioId: 'e1e2e3e4-a7b8-4c9d-8e1f-2a3b4c5d6e7f',
      clienteRazonSocial: 'SAN FERNANDO S.A.',
      sedeDireccion: 'Carretera Central Km 18',
      fecha: '2026-11-03',
      horaInicio: '09:00',
      horaTermino: '12:00',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 40,
      cebosConsumidos: 1,
      cebosRepuestos: 1,
      tipoTrampa: 'NINGUNA',
      trampasInstaladas: 0,
      trampasActivadas: 0,
      roedoresDetectados: [],
      resultadosRecomendaciones: 'Revisión regular.',
      observacionesCliente: 'Conforme.',
      firmas: {
        personalResponsableNombre: 'Ana Torres',
        personalResponsableCargo: 'Técnico Operador',
        clienteConformidadNombre: 'Luis Mendoza',
        clienteConformidadCargo: 'Encargado de Seguridad',
        fecha: '2026-11-03',
        responsableNoDisponible: false,
        firmaDigitalBase64: 'data:image/svg+xml;base64,PHN2Zz48cGF0aCBkPSJNIDAgMCBMIDEwIDEwIi8+PC9zdmc+',
      },
      planillaEstaciones: [
        // huboConsumo undefined pero estado CON_CONSUMO -> huboConsumo: true y colorIcono: 'ROJO'
        {
          numero: 1,
          estado: 'CON_CONSUMO',
          consumoGramos: 10,
          repuestoGramos: 10,
          estadoFisico: 'MALAS_CONDICIONES',
          observaciones: 'Estación golpeada',
        },
        // primera instalación en malas condiciones -> colorIcono: 'VERDE', colorAura: 'SIN_COLOR'
        {
          numero: 2,
          estado: 'SIN_ACTIVIDAD',
          esInstalacion: true,
          estadoFisico: 'MALAS_CONDICIONES',
          observaciones: 'Tapa fisurada',
        },
      ],
      fotos: [],
    };

    await repo.guardarDrt(acta, { usuarioId: usuarioUuid });
    await repo.finalizarYEncolarDrt(acta, usuarioUuid, undefined, {
      encolarEstacionesIndividuales: true,
    });

    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const estacionesOps = outbox
      .obtenerPendientes()
      .filter((p) => p.operacion.tipo === 'REGISTRO_ESTACION');

    expect(estacionesOps).toHaveLength(2);
    for (const op of estacionesOps) {
      expect(OperacionSyncSchema.safeParse(op.operacion).success).toBe(true);
    }

    const est1 = estacionesOps.find((p) => p.operacion.payload.numeroEstacion === 1)!.operacion.payload;
    expect(est1.huboConsumo).toBe(true);
    expect(est1.colorIcono).toBe('ROJO');
    expect(est1.colorAura).toBeUndefined();

    const est2 = estacionesOps.find((p) => p.operacion.payload.numeroEstacion === 2)!.operacion.payload;
    expect(est2.huboConsumo).toBe(false);
    expect(est2.colorIcono).toBe('VERDE');
    expect(est2.colorAura).toBe('SIN_COLOR');
  });

  it('finaliza el servicio de campo por bloques y encola la operacion en sync_outbox (GAF-34)', async () => {
    const servicioUuid = 'd2222222-2222-4000-8000-000000000002';
    const usuarioUuid = '33333333-3333-4000-8000-000000000002';

    const f: FormularioCampo = crearFormularioCampo({
      cliente: { id: 'c2', razonSocial: 'GLORIA S.A.' },
      sede: { id: 'p2', nombre: 'PLANTA_HUACHIPA' },
      servicio: {
        id: servicioUuid,
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
      tecnicoId: usuarioUuid,
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

    await repo.guardarCampo(f, { usuarioId: usuarioUuid });
    expect(await repo.obtenerPorServicioId(f.servicioId, usuarioUuid)).not.toBeNull();

    const { operationId } = await repo.finalizarYEncolarCampo(f, usuarioUuid);
    expect(operationId).toBeDefined();

    // El borrador activo se limpió para la clave compuesta (servicio_id, usuario_id)
    expect(await repo.obtenerPorServicioId(f.servicioId, usuarioUuid)).toBeNull();

    // La operación se encuentra en la cola Outbox y cumple OperacionSyncSchema
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes.length).toBe(1);
    expect(OperacionSyncSchema.safeParse(pendientes[0].operacion).success).toBe(true);
    expect(pendientes[0].operacion.operationId).toBe(operationId);
    expect(pendientes[0].operacion.tipo).toBe('REGISTRO_SERVICIO_CAMPO');
    expect(pendientes[0].operacion.agregadoId).toBe(f.servicioId);
    expect(pendientes[0].operacion.actorId).toBe(usuarioUuid);
  });

  it('rechaza finalizarYEncolarCampo con usuarioId o servicioId no-UUID y conserva el borrador sin contaminar sync_outbox (F6)', async () => {
    const f: FormularioCampo = crearFormularioCampo({
      cliente: { razonSocial: 'GLORIA S.A.' },
      sede: { nombre: 'PLANTA_HUACHIPA' },
      servicio: {
        id: 'd2222222-2222-4000-8000-000000000099',
        tipo: 'DESINFECCION AMBIENTAL',
        tipoServicio: 'DSF',
        requiereCertificado: false,
      },
      tecnicoNombre: 'Marco Ipusari',
    });
    f.insumos[0].lote = 'L-01';
    f.insumos[0].vencimiento = '2027-10-01';
    f.insumos[0].cantidad = '10';
    f.insumos[0].zonas = 'Nave 1';
    f.temperatura = '21';
    f.humedad = '60';
    f.viento = '8';
    f.estadoGeneral = 'Bueno';
    f.nivelInfestacion = 'Nulo';
    f.responsableNoDisponible = true;

    await repo.guardarCampo(f, { usuarioId: 'tecnico-operador-local' });
    await expect(repo.finalizarYEncolarCampo(f, 'tecnico-operador-local')).rejects.toThrow();

    // El borrador no fue eliminado y sync_outbox sigue vacío
    expect(await repo.obtenerPorServicioId(f.servicioId, 'tecnico-operador-local')).not.toBeNull();
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    expect(outbox.obtenerPendientes()).toHaveLength(0);

    // También rechaza si servicioId no es UUID aunque usuarioId sí sea UUID válido
    const usuarioUuid = '33333333-3333-4000-8000-000000000009';
    const fIdInvalido: FormularioCampo = { ...f, servicioId: 'contingencia-local-1' };
    await repo.guardarCampo(fIdInvalido, { usuarioId: usuarioUuid });
    await expect(repo.finalizarYEncolarCampo(fIdInvalido, usuarioUuid)).rejects.toThrow();
    expect(await repo.obtenerPorServicioId(fIdInvalido.servicioId, usuarioUuid)).not.toBeNull();
    await outbox.inicializar();
    expect(outbox.obtenerPendientes()).toHaveLength(0);
  });

  it('permite coexistencia sin pérdida de datosCampo y datosDrt para el mismo servicioId y usuarioId (F1)', async () => {
    const servicioUuid = 'd4444444-4444-4000-8000-000000000004';
    const usuarioUuid = '33333333-3333-4000-8000-000000000004';

    const campo = crearFormularioCampo({
      cliente: { razonSocial: 'ALICORP S.A.A.' },
      sede: { nombre: 'PLANTA_CALLAO' },
      servicio: {
        id: servicioUuid,
        tipo: 'DESINSECTACION Y DESRATIZACION',
      },
      tecnicoNombre: 'Juan Perez',
    });
    campo.observacionesLibre = 'Hallazgos de campo guardados';
    campo.insumos[0].lote = 'L-COEX-01';

    const acta: ActaServicioDrt = {
      servicioId: servicioUuid,
      clienteRazonSocial: 'ALICORP S.A.A.',
      sedeDireccion: 'PLANTA_CALLAO',
      fecha: '2026-11-03',
      horaInicio: '08:30',
      horaTermino: '10:30',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 10,
      cebosConsumidos: 2,
      cebosRepuestos: 2,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 4,
      trampasActivadas: 1,
      roedoresDetectados: ['R_NORVEGICUS'],
      resultadosRecomendaciones: '',
      observacionesCliente: 'Conforme',
      firmas: {
        personalResponsableNombre: 'Juan Perez',
        personalResponsableCargo: 'Técnico',
        clienteConformidadNombre: 'Luis Vega',
        clienteConformidadCargo: 'Supervisor',
        fecha: '2026-11-03',
        responsableNoDisponible: false,
        firmaDigitalBase64: 'data:image/svg+xml;base64,PHN2Zz48cGF0aCBkPSJNIDAgMCBMIDEwIDEwIi8+PC9zdmc+',
      },
      planillaEstaciones: [
        { numero: 1, estado: 'CON_CONSUMO', consumoGramos: 10, repuestoGramos: 10 },
      ],
      fotos: [],
    };

    // 1. Guardar campo primero, luego DRT: ambos deben coexistir
    await repo.guardarCampo(campo, { usuarioId: usuarioUuid });
    await repo.guardarDrt(acta, { usuarioId: usuarioUuid });

    const trasDrt = await repo.obtenerPorServicioId(servicioUuid, usuarioUuid);
    expect(trasDrt?.datosCampo?.insumos[0].lote).toBe('L-COEX-01');
    expect(trasDrt?.datosCampo?.observacionesLibre).toBe('Hallazgos de campo guardados');
    expect(trasDrt?.datosDrt?.planillaEstaciones[0].consumoGramos).toBe(10);
    expect(trasDrt?.observaciones).toBe('Hallazgos de campo guardados');

    // 2. Volver a guardar campo: datosDrt debe seguir intacto
    campo.observacionesLibre = 'Hallazgos actualizados al volver';
    await repo.guardarCampo(campo, { usuarioId: usuarioUuid });

    const trasCampo = await repo.obtenerPorServicioId(servicioUuid, usuarioUuid);
    expect(trasCampo?.datosCampo?.observacionesLibre).toBe('Hallazgos actualizados al volver');
    expect(trasCampo?.datosDrt?.firmas.clienteConformidadNombre).toBe('Luis Vega');
    expect(trasCampo?.datosDrt?.planillaEstaciones).toHaveLength(1);
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
