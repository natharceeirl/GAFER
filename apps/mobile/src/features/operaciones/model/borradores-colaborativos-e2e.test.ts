/**
 * GAFER Mobile — E2E Test: Borradores y Trabajo Colaborativo Multi-Técnico (GAF-37)
 *
 * Criterios de aceptación (GAF-37 / §8.2):
 * 1. Guardar como borrador en cualquier momento con técnico, fecha y hora.
 * 2. Varios técnicos en el mismo proyecto: si dos registran la misma estación,
 *    prevalece el último dato (§8.2, Last-Write-Wins / LWW).
 * 3. Al cerrar la inspección se bloquea para todos y pasa a revisión.
 * 4. Listo cuando: dos dispositivos trabajan el mismo proyecto y se cierra sin pérdida de datos.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ActaServicioDrt,
  ActaServicioDrtSchema,
  ItemEstacionPlanilla,
} from '@gafer/contracts';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
  SqliteDatabasePort,
} from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { BorradorRepository } from './borrador-repository';
import {
  fusionarActasColaborativas,
  fusionarEstacionesLww,
  verificarBloqueoInspeccion,
  formatearDetalleBorrador,
} from './trabajo-colaborativo';

describe('E2E: Borradores y Trabajo Colaborativo Multi-Técnico (§8.2, GAF-37)', () => {
  let dbDispositivo1: SqliteDatabasePort;
  let repo1: BorradorRepository;

  const servicioId = 'c1000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    dbDispositivo1 = await inicializarBaseDeDatos();
    repo1 = new BorradorRepository(dbDispositivo1);
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  describe('1. Guardar como borrador en cualquier momento con técnico, fecha y hora', () => {
    it('persiste de forma durable el borrador con la metadata del técnico y marca temporal', async () => {
      const actaInicial: ActaServicioDrt = {
        servicioId,
        clienteRazonSocial: 'ALICORP S.A.A.',
        sedeDireccion: 'Planta Central, Callao',
        fecha: '2026-11-03',
        areaTratadaM2: 2000,
        horaInicio: '08:00',
        horaTermino: '11:30',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 30,
        cebosConsumidos: 3,
        cebosRepuestos: 3,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 10,
        trampasActivadas: 1,
        roedoresDetectados: ['R_NORVEGICUS'],
        resultadosRecomendaciones: 'Inspección en progreso por sector norte.',
        observacionesCliente: 'Turno mañana en operación.',
        firmas: {
          personalResponsableNombre: 'Mario Silva',
          personalResponsableCargo: 'Técnico Especialista',
          clienteConformidadNombre: '',
          clienteConformidadCargo: '',
          fecha: '2026-11-03',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [
          {
            numero: 1,
            estado: 'SIN_ACTIVIDAD',
            actualizadoEn: '2026-11-03T08:45:00Z',
            actualizadoPor: 'Mario Silva',
          },
        ],
        fotos: [],
      };

      // Guardar borrador manual con técnico
      const borradorGuardado = await repo1.guardarDrt(actaInicial, {
        clienteRazonSocial: 'ALICORP S.A.A.',
        sedeNombre: 'Planta Central, Callao',
        servicioTipo: 'DESRATIZACION_DRT',
        tecnicoId: 'usr-tec-01',
        tecnicoNombre: 'Mario Silva',
        tecnicoCargo: 'Técnico Especialista',
      });

      expect(borradorGuardado.servicioId).toBe(servicioId);
      expect(borradorGuardado.actualizadoEn).toBeDefined();
      expect(borradorGuardado.guardadoPor?.nombre).toBe('Mario Silva');
      expect(borradorGuardado.bloqueada).toBe(false);

      // Recuperar de SQLite y verificar persistencia durable
      const borradorDb = await repo1.obtenerPorServicioId(servicioId);
      expect(borradorDb).not.toBeNull();
      expect(borradorDb?.actualizadoEn).toBeDefined();
      expect(borradorDb?.guardadoPor?.nombre).toBe('Mario Silva');

      // Formato legible de fecha y hora
      const detalleTexto = formatearDetalleBorrador(borradorDb?.actualizadoEn, borradorDb?.guardadoPor?.nombre);
      expect(detalleTexto).toContain('Mario Silva');
      expect(detalleTexto).toContain(new Date().toISOString().slice(0, 10));
    });
  });

  describe('2. Trabajo Colaborativo entre Dos Técnicos: Resolución LWW (§8.2)', () => {
    it('dos técnicos registran estaciones del mismo proyecto: la colisión resuelve por LWW y no se pierde ninguna estación', () => {
      // Dispositivo 1 (Técnico 1: Juan) registra estaciones 1 y 2
      const estacionesJuan: ItemEstacionPlanilla[] = [
        {
          numero: 1,
          tipoCebo: 'BLOQUE_10G',
          cantidadGramos: 20,
          estado: 'SIN_ACTIVIDAD',
          huboConsumo: false,
          actualizadoEn: '2026-11-03T09:00:00Z',
          actualizadoPor: 'Juan Quispe',
        },
        {
          numero: 2,
          tipoCebo: 'BLOQUE_10G',
          cantidadGramos: 20,
          estado: 'SIN_ACTIVIDAD', // Juan ve sin actividad a las 09:05
          huboConsumo: false,
          actualizadoEn: '2026-11-03T09:05:00Z',
          actualizadoPor: 'Juan Quispe',
        },
      ];

      // Dispositivo 2 (Técnico 2: Pedro) registra estaciones 2 y 3
      const estacionesPedro: ItemEstacionPlanilla[] = [
        {
          numero: 2, // Colisión en estación 2: Pedro detecta consumo a las 09:30 (más reciente)
          tipoCebo: 'BLOQUE_10G',
          cantidadGramos: 20,
          estado: 'CON_CONSUMO',
          huboConsumo: true,
          porcentajeConsumo: 50,
          consumoGramos: 10,
          repuestoGramos: 10,
          observaciones: 'Consumo registrado por Pedro en segunda pasada',
          actualizadoEn: '2026-11-03T09:30:00Z',
          actualizadoPor: 'Pedro Gomez',
        },
        {
          numero: 3,
          tipoCebo: 'BLOQUE_10G',
          cantidadGramos: 20,
          estado: 'SIN_ACTIVIDAD',
          huboConsumo: false,
          actualizadoEn: '2026-11-03T09:35:00Z',
          actualizadoPor: 'Pedro Gomez',
        },
      ];

      // Fusión colaborativa de estaciones
      const { estaciones, conflictos } = fusionarEstacionesLww(estacionesJuan, estacionesPedro);

      // Verificación 1: Ninguna estación se pierde (estaciones 1, 2 y 3 presentes)
      expect(estaciones).toHaveLength(3);
      expect(estaciones.map((e) => e.numero)).toEqual([1, 2, 3]);

      // Verificación 2: Estación 1 (de Juan) se preservó intacta
      const est1 = estaciones.find((e) => e.numero === 1);
      expect(est1?.actualizadoPor).toBe('Juan Quispe');
      expect(est1?.estado).toBe('SIN_ACTIVIDAD');

      // Verificación 3: Estación 2 (en colisión) prevaleció el último dato (Pedro Gomez)
      expect(conflictos).toHaveLength(1);
      expect(conflictos[0].numeroEstacion).toBe(2);
      expect(conflictos[0].ganador).toBe('REMOTO');

      const est2 = estaciones.find((e) => e.numero === 2);
      expect(est2?.estado).toBe('CON_CONSUMO');
      expect(est2?.consumoGramos).toBe(10);
      expect(est2?.actualizadoPor).toBe('Pedro Gomez');
      expect(est2?.observaciones).toContain('segunda pasada');

      // Verificación 4: Estación 3 (de Pedro) se agregó sin problemas
      const est3 = estaciones.find((e) => e.numero === 3);
      expect(est3?.actualizadoPor).toBe('Pedro Gomez');
    });
  });

  describe('3. Bloqueo al Cerrar la Inspección y Paso a Revisión (§8.2)', () => {
    it('al cerrar la inspección se bloquea para todos y pasa a modo de solo lectura', async () => {
      // 1. Técnico 1 cierra la inspección
      const actaCerrada: ActaServicioDrt = {
        servicioId,
        clienteRazonSocial: 'NESTLÉ PERÚ S.A.',
        sedeDireccion: 'Planta Industrial',
        fecha: '2026-11-03',
        areaTratadaM2: 1500,
        horaInicio: '08:30',
        horaTermino: '12:00',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 40,
        cebosConsumidos: 5,
        cebosRepuestos: 5,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 10,
        trampasActivadas: 2,
        roedoresDetectados: ['R_NORVEGICUS'],
        resultadosRecomendaciones: 'Servicio concluido a conformidad.',
        observacionesCliente: 'Recibido por supervisor de planta.',
        firmas: {
          personalResponsableNombre: 'Mario Silva',
          personalResponsableCargo: 'Técnico Especialista',
          clienteConformidadNombre: 'Ing. Carlos Mendez',
          clienteConformidadCargo: 'Jefe de Seguridad',
          fecha: '2026-11-03',
          firmaDigitalBase64: 'base64-firma-valida',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [
          { numero: 1, estado: 'SIN_ACTIVIDAD' },
          { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 10, repuestoGramos: 10 },
        ],
        fotos: [],
        cerradaEnRevision: true,
        cerradoPor: 'Mario Silva',
      };

      // 2. Persistir como inspección cerrada
      await repo1.guardarDrt(actaCerrada);

      // 3. Verificar estado bloqueado
      const borrador = await repo1.obtenerPorServicioId(servicioId);
      expect(borrador).not.toBeNull();
      expect(borrador?.bloqueada).toBe(true);
      expect(borrador?.syncStatus).toBe('LOCKED');
      expect(borrador?.motivoBloqueo).toContain('Sección 8.2');

      const estadoBloqueo = verificarBloqueoInspeccion(borrador?.datosDrt || {});
      expect(estadoBloqueo.bloqueada).toBe(true);
      expect(estadoBloqueo.cerradaPor).toBe('Mario Silva');
    });

    it('Outbox detecta rechazo 409 de inspección cerrada en el servidor y bloquea el borrador local', async () => {
      const outbox = new OutboxQueue(dbDispositivo1);

      // Crear borrador local
      await repo1.guardar(servicioId, {
        clienteRazonSocial: 'GLORIA S.A.',
        sedeNombre: 'Huachipa',
      });

      // Encolar una operación de estación
      await outbox.encolar({
        operationId: '11111111-2222-3333-4444-555555555555',
        tipo: 'REGISTRO_ESTACION',
        agregadoId: servicioId,
        actorId: 'usr-tec-02',
        clienteTimestamp: new Date().toISOString(),
        payload: { numeroEstacion: 4, huboConsumo: true },
      });

      // Simular respuesta 409 Conflict del servidor (inspección ya cerrada por supervisión u otro técnico)
      const mockFetch409 = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          statusCode: 409,
          message: 'La inspección está cerrada y no acepta más sincronizaciones de campo (Sección 8.2)',
        }),
      });

      await outbox.inicializar();
      const resultadoSync = await outbox.enviarLote('http://localhost:3000', servicioId, mockFetch409 as any);
      expect(resultadoSync).toBeNull();

      // Verificar que el borrador local se marcó automáticamente como LOCKED
      const borradorBloqueado = await repo1.obtenerPorServicioId(servicioId);
      expect(borradorBloqueado?.syncStatus).toBe('LOCKED');
      expect(borradorBloqueado?.bloqueada).toBe(true);
    });
  });

  describe('4. Flujo Completo: Dos Dispositivos Trabajan el Mismo Proyecto y se Cierra sin Pérdida de Datos', () => {
    it('simula la sincronización y fusión completa de dos dispositivos culminando en cierre seguro', async () => {
      // Dispositivo 1 (Juan): Inicia servicio y revisa estaciones 1, 2, 3
      const actaDispositivo1: ActaServicioDrt = {
        servicioId,
        clienteRazonSocial: 'SAN FERNANDO S.A.',
        sedeDireccion: 'Granja 04, Huaral',
        fecha: '2026-11-03',
        areaTratadaM2: 5000,
        horaInicio: '07:30',
        horaTermino: '12:30',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 60,
        cebosConsumidos: 10,
        cebosRepuestos: 10,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 20,
        trampasActivadas: 3,
        roedoresDetectados: ['R_NORVEGICUS', 'R_RATTUS'],
        resultadosRecomendaciones: 'Cebaderos de galpón 1 y 2 monitoreados.',
        observacionesCliente: 'Reporte matutino.',
        firmas: {
          personalResponsableNombre: 'Juan Quispe',
          personalResponsableCargo: 'Técnico Operador',
          clienteConformidadNombre: '',
          clienteConformidadCargo: '',
          fecha: '2026-11-03',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [
          { numero: 1, estado: 'SIN_ACTIVIDAD', actualizadoEn: '2026-11-03T08:00:00Z', actualizadoPor: 'Juan' },
          { numero: 2, estado: 'CON_CONSUMO', consumoGramos: 10, repuestoGramos: 10, actualizadoEn: '2026-11-03T08:10:00Z', actualizadoPor: 'Juan' },
          { numero: 3, estado: 'SIN_ACTIVIDAD', actualizadoEn: '2026-11-03T08:20:00Z', actualizadoPor: 'Juan' },
        ],
        fotos: [
          {
            id: 'fa111111-1111-1111-1111-111111111111',
            nombre: 'galpon_1_cebadero.jpg',
            rutaLocalRelativa: 'photos/PH_01.jpg',
            tamanoBytes: 400 * 1024,
            sha256: 'sha256-foto-juan',
            mimeType: 'image/jpeg',
            capturadaEn: '2026-11-03T08:05:00Z',
          },
        ],
      };

      // Dispositivo 2 (Pedro): Simultáneamente revisa estaciones 3, 4, 5 y toma la firma final
      const actaDispositivo2: ActaServicioDrt = {
        ...actaDispositivo1,
        observacionesCliente: 'Servicio recibido a entera satisfacción.',
        resultadosRecomendaciones: 'Cebaderos de galpón 3 y 4 monitoreados.',
        firmas: {
          personalResponsableNombre: 'Pedro Gomez',
          personalResponsableCargo: 'Técnico Especialista',
          clienteConformidadNombre: 'Roberto Alvarez',
          clienteConformidadCargo: 'Administrador de Granja',
          fecha: '2026-11-03',
          firmaDigitalBase64: 'data:image/png;base64,firma-digital-roberto',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [
          { numero: 3, estado: 'CON_CONSUMO', consumoGramos: 15, repuestoGramos: 15, actualizadoEn: '2026-11-03T08:40:00Z', actualizadoPor: 'Pedro' }, // LWW en 3
          { numero: 4, estado: 'SIN_ACTIVIDAD', actualizadoEn: '2026-11-03T08:50:00Z', actualizadoPor: 'Pedro' },
          { numero: 5, estado: 'SIN_ACCESO', observaciones: 'Galpón en cuarentena', actualizadoEn: '2026-11-03T09:00:00Z', actualizadoPor: 'Pedro' },
        ],
        fotos: [
          {
            id: 'fa222222-2222-2222-2222-222222222222',
            nombre: 'galpon_3_consumo.jpg',
            rutaLocalRelativa: 'photos/PH_02.jpg',
            tamanoBytes: 650 * 1024,
            sha256: 'sha256-foto-pedro',
            mimeType: 'image/jpeg',
            capturadaEn: '2026-11-03T08:42:00Z',
          },
        ],
        cerradaEnRevision: true, // Pedro concluye el servicio en campo
        cerradoPor: 'Pedro Gomez',
      };

      // 1. Fusión de ambos trabajos colaborativos
      const { acta: actaFinal, conflictos, fueBloqueada } = fusionarActasColaborativas(
        actaDispositivo1,
        actaDispositivo2,
      );

      // 2. Validación de Criterios GAF-37:
      // a) No hay pérdida de estaciones (1, 2, 3, 4, 5 todas presentes)
      expect(actaFinal.planillaEstaciones).toHaveLength(5);
      expect(actaFinal.planillaEstaciones.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5]);

      // b) LWW en estación 3: prevalece dato de Pedro (15g consumo)
      expect(conflictos).toHaveLength(1);
      const est3 = actaFinal.planillaEstaciones.find((e) => e.numero === 3);
      expect(est3?.estado).toBe('CON_CONSUMO');
      expect(est3?.consumoGramos).toBe(15);
      expect(est3?.actualizadoPor).toBe('Pedro');

      // c) No hay pérdida de fotos (foto de Juan + foto de Pedro unificadas)
      expect(actaFinal.fotos).toHaveLength(2);

      // d) Firma y conformidad capturadas
      expect(actaFinal.firmas.firmaDigitalBase64).toBe('data:image/png;base64,firma-digital-roberto');
      expect(actaFinal.firmas.clienteConformidadNombre).toBe('Roberto Alvarez');

      // e) Bloqueo y paso a revisión
      expect(fueBloqueada).toBe(true);
      expect(actaFinal.cerradaEnRevision).toBe(true);
      expect(actaFinal.cerradoPor).toBe('Pedro Gomez');

      // f) Acta final válida contra el esquema contractual Zod
      expect(() => ActaServicioDrtSchema.parse(actaFinal)).not.toThrow();

      // g) Guardado durable en SQLite del resultado
      const borradorConsolidado = await repo1.guardarDrt(actaFinal);
      expect(borradorConsolidado.bloqueada).toBe(true);
      expect(borradorConsolidado.syncStatus).toBe('LOCKED');
    });
  });
});
