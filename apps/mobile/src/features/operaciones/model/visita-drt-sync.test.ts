import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ActaServicioDrt,
  ActaServicioDrtSchema,
  LoteSyncRequest,
  LoteSyncResponse,
  PayloadEstacionSyncSchema,
  OperacionSyncSchema,
} from '@gafer/contracts';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
} from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { BorradorRepository } from './borrador-repository';
import {
  crearEstacionDrt,
  aplicarPrimeraVisita,
  actualizarConsumoEstacion,
  actualizarEstadoFisicoEstacion,
  validarEstacionesPlanilla,
} from './estaciones-drt';

describe('Flujo E2E: Registro de Estaciones de Roedores y Sincronización (§5.1, GAF-35)', () => {
  let repo: BorradorRepository;

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    const db = await inicializarBaseDeDatos();
    repo = new BorradorRepository(db);
    await repo.limpiarTodos();
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  it('registra una primera visita (instalación de estaciones): registra cebo y estado físico sin evaluar consumo (§5.1)', async () => {
    const servicioId = '11111111-2222-3333-4444-555555555555';
    const tecnicoId = '66666666-7777-8888-9999-000000000000';

    // 1. Estaciones iniciales creadas en primera visita
    const estacionesInstaladas = [
      crearEstacionDrt(1, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'L-INSTALACION-2026',
        vencimiento: '2027-10-30',
        estadoFisico: 'BUENAS_CONDICIONES',
        esInstalacion: true,
      }),
      crearEstacionDrt(2, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'L-INSTALACION-2026',
        vencimiento: '2027-10-30',
        estadoFisico: 'BUENAS_CONDICIONES',
        esInstalacion: true,
      }),
    ];

    const estacionesConfiguradas = aplicarPrimeraVisita(estacionesInstaladas, true);

    const actaPrimeraVisita: ActaServicioDrt = {
      servicioId,
      clienteRazonSocial: 'ALMACENES CENTRALES S.A.C.',
      sedeDireccion: 'Av. Industrial 500, Callao',
      fecha: '2026-11-03',
      horaInicio: '08:00',
      horaTermino: '10:00',
      primeraVisita: true,
      actividad: 'INSTALACION',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 40,
      cebosConsumidos: 0,
      cebosRepuestos: 0,
      tipoTrampa: 'NINGUNA',
      trampasInstaladas: 0,
      trampasActivadas: 0,
      roedoresDetectados: [],
      resultadosRecomendaciones: 'Instalación perimétrica completada de acuerdo a plano de cebaderos.',
      observacionesCliente: 'Instalación aprobada por supervisor de planta.',
      firmas: {
        personalResponsableNombre: 'Juan Quispe',
        personalResponsableCargo: 'Técnico Especialista',
        clienteConformidadNombre: 'Roberto Gomez',
        clienteConformidadCargo: 'Jefe de Planta',
        fecha: '2026-11-03',
        responsableNoDisponible: false,
      },
      planillaEstaciones: estacionesConfiguradas,
      fotos: [],
    };

    // Validar contratos y requerimientos §5.1
    expect(() => ActaServicioDrtSchema.parse(actaPrimeraVisita)).not.toThrow();
    const validacion = validarEstacionesPlanilla(actaPrimeraVisita.planillaEstaciones, true);
    expect(validacion.valido).toBe(true);

    // 2. Persistir borrador en SQLite de forma durable ("Durable before visible")
    await repo.guardarDrt(actaPrimeraVisita);
    const guardado = await repo.obtenerPorServicioId(servicioId);
    expect(guardado?.datosDrt?.primeraVisita).toBe(true);
    expect(guardado?.datosDrt?.planillaEstaciones[0].esInstalacion).toBe(true);
    expect(guardado?.datosDrt?.planillaEstaciones[0].huboConsumo).toBe(false);

    // 3. Finalizar y encolar servicio y estaciones individuales
    const resultado = await repo.finalizarYEncolarDrt(actaPrimeraVisita, tecnicoId, 'terminal-mobile-01', {
      encolarEstacionesIndividuales: true,
    });
    expect(resultado.operationId).toBeDefined();
    expect(resultado.estacionesOperacionesIds).toHaveLength(2);

    // 4. Verificar que se removió el borrador activo y las operaciones están en sync_outbox
    expect(await repo.obtenerPorServicioId(servicioId)).toBeNull();

    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientes = outbox.obtenerPendientes();
    expect(pendientes).toHaveLength(3); // 2 estaciones + 1 servicio DRT

    const opEstacion1 = pendientes.find((p) => (p.operacion.payload as any).numeroEstacion === 1);
    expect(opEstacion1).toBeDefined();
    expect(opEstacion1?.operacion.tipo).toBe('REGISTRO_ESTACION');
    expect((opEstacion1?.operacion.payload as any).esInstalacion).toBe(true);
    expect((opEstacion1?.operacion.payload as any).huboConsumo).toBe(false);
  });

  it('registra una visita regular completa con porcentajes de consumo (0, 25, 50, 75, 100%), estado físico, reposición y sincroniza vía outbox (Listo cuando)', async () => {
    const servicioId = '22222222-3333-4444-5555-666666666666';
    const tecnicoId = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';

    // Estaciones inspeccionadas en visita regular (§5.1):
    // Estación 1: Sin consumo (0%)
    const est1 = actualizarConsumoEstacion(
      crearEstacionDrt(1, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'L-2026-A',
        vencimiento: '2027-06-30',
      }),
      false,
    );

    // Estación 2: Consumo 25% (5g consumidos de 20g base)
    const est2 = actualizarConsumoEstacion(
      crearEstacionDrt(2, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'L-2026-A',
        vencimiento: '2027-06-30',
      }),
      true,
      25,
    );

    // Estación 3: Consumo 50% (10g consumidos de 20g base)
    const est3 = actualizarConsumoEstacion(
      crearEstacionDrt(3, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'L-2026-A',
        vencimiento: '2027-06-30',
      }),
      true,
      50,
    );

    // Estación 4: Consumo 75% (15g consumidos de 20g base)
    const est4 = actualizarConsumoEstacion(
      crearEstacionDrt(4, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'L-2026-A',
        vencimiento: '2027-06-30',
      }),
      true,
      75,
    );

    // Estación 5: Consumo 100% (20g consumidos de 20g base) + Malas condiciones físicas con detalle
    const est5 = actualizarEstadoFisicoEstacion(
      actualizarConsumoEstacion(
        crearEstacionDrt(5, {
          tipoCebo: 'BLOQUE_10G',
          cantidadGramos: 20,
          lote: 'L-2026-A',
          vencimiento: '2027-06-30',
        }),
        true,
        100,
      ),
      'MALAS_CONDICIONES',
      'Cebadero roto por tránsito de carretilla; se programa reemplazo en siguiente visita.',
    );

    const estaciones = [est1, est2, est3, est4, est5];

    // Verificaciones unitarias de cálculo (§5.1)
    expect(est1.consumoGramos).toBe(0);
    expect(est1.repuestoGramos).toBe(0);
    expect(est1.estado).toBe('SIN_ACTIVIDAD');

    expect(est2.consumoGramos).toBe(5);
    expect(est2.repuestoGramos).toBe(5);
    expect(est2.estado).toBe('CON_CONSUMO');

    expect(est3.consumoGramos).toBe(10);
    expect(est3.repuestoGramos).toBe(10);
    expect(est3.estado).toBe('CON_CONSUMO');

    expect(est4.consumoGramos).toBe(15);
    expect(est4.repuestoGramos).toBe(15);
    expect(est4.estado).toBe('CON_CONSUMO');

    expect(est5.consumoGramos).toBe(20);
    expect(est5.repuestoGramos).toBe(20);
    expect(est5.estadoFisico).toBe('MALAS_CONDICIONES');

    // Validación de requerimientos de planilla
    const resVal = validarEstacionesPlanilla(estaciones, false);
    expect(resVal.valido).toBe(true);

    // Acta completa de desratización
    const actaRegular: ActaServicioDrt = {
      servicioId,
      clienteRazonSocial: 'MOLINOS DEL PERÚ S.A.',
      sedeDireccion: 'Carretera Central Km 14, Ate',
      fecha: '2026-11-03',
      horaInicio: '09:00',
      horaTermino: '11:30',
      primeraVisita: false,
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 100,
      cebosConsumidos: 4,
      cebosRepuestos: 4,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 10,
      trampasActivadas: 1,
      roedoresDetectados: ['R_RATTUS'],
      resultadosRecomendaciones: 'Actividad concentrada en estación 5 exterior. Se repuso cebo al 100%.',
      observacionesCliente: 'Servicio recibido a conformidad.',
      firmas: {
        personalResponsableNombre: 'Mario Silva',
        personalResponsableCargo: 'Técnico Especialista',
        clienteConformidadNombre: 'Laura Vega',
        clienteConformidadCargo: 'Supervisora de Calidad',
        fecha: '2026-11-03',
        responsableNoDisponible: false,
      },
      planillaEstaciones: estaciones,
      fotos: [],
    };

    expect(() => ActaServicioDrtSchema.parse(actaRegular)).not.toThrow();

    // 1. Guardar de forma durable en SQLite
    await repo.guardarDrt(actaRegular);
    const borradorLocal = await repo.obtenerPorServicioId(servicioId);
    expect(borradorLocal).not.toBeNull();
    expect(borradorLocal?.datosDrt?.planillaEstaciones).toHaveLength(5);

    // 2. Finalizar y encolar en Outbox
    const finalizado = await repo.finalizarYEncolarDrt(actaRegular, tecnicoId, 'device-movil-01', {
      encolarEstacionesIndividuales: true,
    });
    expect(finalizado.operationId).toBeDefined();
    expect(finalizado.estacionesOperacionesIds).toHaveLength(5);

    // 3. Verificar estado en OutboxQueue
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const pendientesAntes = outbox.obtenerPendientes();
    expect(pendientesAntes).toHaveLength(6); // 5 estaciones + 1 acta DRT

    for (const p of pendientesAntes) {
      expect(() => OperacionSyncSchema.parse(p.operacion)).not.toThrow();
      if (p.operacion.tipo === 'REGISTRO_ESTACION') {
        expect(() => PayloadEstacionSyncSchema.parse(p.operacion.payload)).not.toThrow();
      }
    }

    // 4. SIMULACIÓN DE SINCRONIZACIÓN CON EL SERVIDOR ("se registra una visita completa y se sincroniza")
    const mockFetch: typeof fetch = async (url, options) => {
      const body = JSON.parse(options?.body as string) as LoteSyncRequest;
      expect(body.inspeccionId).toBe(servicioId);
      expect(body.operaciones).toHaveLength(6);

      const responsePayload: LoteSyncResponse = {
        inspeccionId: body.inspeccionId,
        procesadas: body.operaciones.map((o) => o.operationId),
        omitidasIdempotentes: [],
        conflictos: [],
        serverReceivedAt: new Date().toISOString(),
      };

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => responsePayload,
      } as any;
    };

    const resultadoSync = await outbox.enviarLote(
      'http://localhost:3000',
      servicioId,
      mockFetch,
    );

    expect(resultadoSync).not.toBeNull();
    expect(resultadoSync?.procesadas).toHaveLength(6);

    // 5. Verificar que todas las operaciones fueron marcadas y eliminadas de pendientes
    const pendientesDespues = outbox.obtenerPendientes();
    expect(pendientesDespues).toHaveLength(0);
  });
});
