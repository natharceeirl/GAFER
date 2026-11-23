import { describe, it, expect } from 'vitest';
import {
  ItemEstacionPlanilla,
  FotoEvidenciaDrt,
  ActaServicioDrt,
} from '@gafer/contracts';
import {
  fusionarEstacionesLww,
  fusionarFotosEvidencia,
  verificarBloqueoInspeccion,
  fusionarActasColaborativas,
  formatearDetalleBorrador,
  compararTimestampsIso,
} from './trabajo-colaborativo';

describe('Trabajo Colaborativo Multi-Técnico y Resolución de Conflictos LWW (§8.2, GAF-37)', () => {
  describe('1. Comparación de Timestamps ISO', () => {
    it('determina correctamente qué marca de tiempo es más reciente', () => {
      const t1 = '2026-11-03T10:00:00Z';
      const t2 = '2026-11-03T10:15:00Z';

      expect(compararTimestampsIso(t1, t2)).toBeGreaterThan(0); // t2 > t1
      expect(compararTimestampsIso(t2, t1)).toBeLessThan(0); // t1 < t2
      expect(compararTimestampsIso(t1, t1)).toBe(0); // iguales
    });
  });

  describe('2. Fusión de Estaciones de Control (Last-Write-Wins §8.2)', () => {
    it('combina estaciones disjuntas de dos técnicos sin pérdida de datos', () => {
      // Técnico 1 revisó estaciones 1 y 2
      const estTecnico1: ItemEstacionPlanilla[] = [
        {
          numero: 1,
          estado: 'SIN_ACTIVIDAD',
          huboConsumo: false,
          actualizadoEn: '2026-11-03T09:30:00Z',
          actualizadoPor: 'Técnico Juan',
        },
        {
          numero: 2,
          estado: 'CON_CONSUMO',
          huboConsumo: true,
          porcentajeConsumo: 25,
          consumoGramos: 5,
          repuestoGramos: 5,
          actualizadoEn: '2026-11-03T09:35:00Z',
          actualizadoPor: 'Técnico Juan',
        },
      ];

      // Técnico 2 revisó estaciones 3 y 4
      const estTecnico2: ItemEstacionPlanilla[] = [
        {
          numero: 3,
          estado: 'SIN_ACTIVIDAD',
          huboConsumo: false,
          actualizadoEn: '2026-11-03T09:40:00Z',
          actualizadoPor: 'Técnico Pedro',
        },
        {
          numero: 4,
          estado: 'EXTRAVIADA',
          observaciones: 'Punto removido en obra',
          actualizadoEn: '2026-11-03T09:45:00Z',
          actualizadoPor: 'Técnico Pedro',
        },
      ];

      const resultado = fusionarEstacionesLww(estTecnico1, estTecnico2);

      expect(resultado.totalEstaciones).toBe(4);
      expect(resultado.conflictos).toHaveLength(0);
      expect(resultado.estaciones.map((e) => e.numero)).toEqual([1, 2, 3, 4]);
      expect(resultado.estaciones[0].actualizadoPor).toBe('Técnico Juan');
      expect(resultado.estaciones[2].actualizadoPor).toBe('Técnico Pedro');
    });

    it('en colisión sobre la misma estación, prevalece el último dato según timestamp (LWW)', () => {
      // Técnico 1 evaluó estación 5 a las 10:00
      const estTecnico1: ItemEstacionPlanilla[] = [
        {
          numero: 5,
          estado: 'SIN_ACTIVIDAD',
          huboConsumo: false,
          consumoGramos: 0,
          observaciones: 'Evaluación inicial',
          actualizadoEn: '2026-11-03T10:00:00Z',
          actualizadoPor: 'Técnico Juan',
        },
      ];

      // Técnico 2 revisó nuevamente estación 5 a las 10:20 (más reciente)
      const estTecnico2: ItemEstacionPlanilla[] = [
        {
          numero: 5,
          estado: 'CON_CONSUMO',
          huboConsumo: true,
          porcentajeConsumo: 50,
          consumoGramos: 10,
          repuestoGramos: 10,
          observaciones: 'Se detectó consumo en segunda ronda',
          actualizadoEn: '2026-11-03T10:20:00Z',
          actualizadoPor: 'Técnico Pedro',
        },
      ];

      const resultado = fusionarEstacionesLww(estTecnico1, estTecnico2);

      expect(resultado.totalEstaciones).toBe(1);
      expect(resultado.conflictos).toHaveLength(1);
      expect(resultado.conflictos[0].ganador).toBe('REMOTO');
      expect(resultado.conflictos[0].numeroEstacion).toBe(5);

      const ganadora = resultado.estaciones[0];
      expect(ganadora.estado).toBe('CON_CONSUMO');
      expect(ganadora.consumoGramos).toBe(10);
      expect(ganadora.actualizadoPor).toBe('Técnico Pedro');
      expect(ganadora.observaciones).toContain('segunda ronda');
    });

    it('respeta dato local si el dato local es más reciente que el remoto', () => {
      const estLocal: ItemEstacionPlanilla[] = [
        {
          numero: 8,
          estado: 'CON_CONSUMO',
          consumoGramos: 15,
          actualizadoEn: '2026-11-03T11:00:00Z', // Local es más reciente
          actualizadoPor: 'Técnico Juan',
        },
      ];

      const estRemota: ItemEstacionPlanilla[] = [
        {
          numero: 8,
          estado: 'SIN_ACTIVIDAD',
          consumoGramos: 0,
          actualizadoEn: '2026-11-03T10:30:00Z', // Remoto es anterior
          actualizadoPor: 'Técnico Pedro',
        },
      ];

      const resultado = fusionarEstacionesLww(estLocal, estRemota);
      expect(resultado.totalEstaciones).toBe(1);
      expect(resultado.conflictos[0].ganador).toBe('LOCAL');
      expect(resultado.estaciones[0].consumoGramos).toBe(15);
      expect(resultado.estaciones[0].actualizadoPor).toBe('Técnico Juan');
    });
  });

  describe('3. Fusión de Fotografías de Evidencia', () => {
    it('combina fotos únicas y elimina duplicados basados en sha256', () => {
      const foto1: FotoEvidenciaDrt = {
        id: '11111111-1111-1111-1111-111111111111',
        nombre: 'foto1.jpg',
        rutaLocalRelativa: 'photos/PH_1.jpg',
        tamanoBytes: 500,
        sha256: 'hash-aaa',
        mimeType: 'image/jpeg',
        capturadaEn: '2026-11-03T10:00:00Z',
      };

      const foto2: FotoEvidenciaDrt = {
        id: '22222222-2222-2222-2222-222222222222',
        nombre: 'foto2.jpg',
        rutaLocalRelativa: 'photos/PH_2.jpg',
        tamanoBytes: 600,
        sha256: 'hash-bbb',
        mimeType: 'image/jpeg',
        capturadaEn: '2026-11-03T10:05:00Z',
      };

      const foto1Duplicada: FotoEvidenciaDrt = {
        ...foto1,
        id: '33333333-3333-3333-3333-333333333333',
      };

      const unificadas = fusionarFotosEvidencia([foto1], [foto2, foto1Duplicada]);
      expect(unificadas).toHaveLength(2);
      expect(unificadas.map((f) => f.sha256)).toEqual(['hash-aaa', 'hash-bbb']);
    });
  });

  describe('4. Bloqueo de Inspección Cerrada (§8.2)', () => {
    it('detecta estado abierto y estado bloqueado incluyendo syncStatus y ENVIADO_A_REVISION (F7)', () => {
      expect(verificarBloqueoInspeccion({ cerradaEnRevision: false, syncStatus: 'PENDING_SYNC', estado: 'BORRADOR' }).bloqueada).toBe(false);
      expect(verificarBloqueoInspeccion({ cerradaEnRevision: true }).bloqueada).toBe(true);
      expect(verificarBloqueoInspeccion({ estado: 'CERRADO' }).bloqueada).toBe(true);
      expect(verificarBloqueoInspeccion({ estado: 'ENVIADO_A_REVISION' }).bloqueada).toBe(true);
      expect(verificarBloqueoInspeccion({ estado: 'EN_REVISION' }).bloqueada).toBe(true);
      expect(verificarBloqueoInspeccion({ estado: 'APROBADO' }).bloqueada).toBe(true);
      expect(verificarBloqueoInspeccion({ syncStatus: 'LOCKED' }).bloqueada).toBe(true);
      expect(verificarBloqueoInspeccion({ syncStatus: 'CLOSED' }).bloqueada).toBe(true);
      expect(verificarBloqueoInspeccion({ bloqueada: true }).bloqueada).toBe(true);
    });
  });

  describe('5. Fusión Integral de Actas Colaborativas', () => {
    it('fusiona el acta completa entre dos dispositivos sin pérdida de datos y propaga bloqueo si se cerró', () => {
      const servicioId = 'a0000000-0000-0000-0000-000000000001';

      const actaDispositivo1: ActaServicioDrt = {
        servicioId,
        clienteRazonSocial: 'MOLITALIA S.A.',
        sedeDireccion: 'Planta Principal',
        fecha: '2026-11-03',
        areaTratadaM2: 1000,
        horaInicio: '08:00',
        horaTermino: '11:00',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 20,
        cebosConsumidos: 2,
        cebosRepuestos: 2,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 5,
        trampasActivadas: 0,
        roedoresDetectados: ['R_NORVEGICUS'],
        resultadosRecomendaciones: 'Revisión perimetral sur completada.',
        observacionesCliente: 'Recibido por guardia sur.',
        firmas: {
          personalResponsableNombre: 'Juan Quispe',
          personalResponsableCargo: 'Técnico Operador',
          clienteConformidadNombre: '',
          clienteConformidadCargo: '',
          fecha: '2026-11-03',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [
          {
            numero: 1,
            estado: 'SIN_ACTIVIDAD',
            actualizadoEn: '2026-11-03T09:00:00Z',
            actualizadoPor: 'Juan Quispe',
          },
          {
            numero: 2,
            estado: 'SIN_ACTIVIDAD',
            actualizadoEn: '2026-11-03T09:10:00Z',
            actualizadoPor: 'Juan Quispe',
          },
        ],
        fotos: [],
      };

      const actaDispositivo2: ActaServicioDrt = {
        ...actaDispositivo1,
        observacionesCliente: 'Recibido conforme en oficina central.',
        resultadosRecomendaciones: 'Revisión perimetral norte completada.',
        firmas: {
          personalResponsableNombre: 'Pedro Gomez',
          personalResponsableCargo: 'Técnico Especialista',
          clienteConformidadNombre: 'Ing. Sanchez',
          clienteConformidadCargo: 'Jefe de Planta',
          fecha: '2026-11-03',
          firmaDigitalBase64: 'base64-firma-cliente',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [
          {
            numero: 2, // Colisión intencional en estación 2 (más reciente)
            estado: 'CON_CONSUMO',
            consumoGramos: 10,
            repuestoGramos: 10,
            actualizadoEn: '2026-11-03T09:40:00Z',
            actualizadoPor: 'Pedro Gomez',
          },
          {
            numero: 3,
            estado: 'SIN_ACTIVIDAD',
            actualizadoEn: '2026-11-03T09:50:00Z',
            actualizadoPor: 'Pedro Gomez',
          },
        ],
        cerradaEnRevision: true, // Pedro cerró la inspección
        cerradoPor: 'Pedro Gomez',
      };

      const resultado = fusionarActasColaborativas(actaDispositivo1, actaDispositivo2);

      expect(resultado.fueBloqueada).toBe(true);
      expect(resultado.acta.cerradaEnRevision).toBe(true);
      expect(resultado.acta.cerradoPor).toBe('Pedro Gomez');

      // Estaciones fusionadas sin pérdida: 1, 2, 3
      expect(resultado.acta.planillaEstaciones).toHaveLength(3);
      expect(resultado.acta.planillaEstaciones.map((e) => e.numero)).toEqual([1, 2, 3]);

      // Estación 2 retiene los datos más recientes de Pedro Gomez
      const est2 = resultado.acta.planillaEstaciones.find((e) => e.numero === 2);
      expect(est2?.estado).toBe('CON_CONSUMO');
      expect(est2?.consumoGramos).toBe(10);
      expect(est2?.actualizadoPor).toBe('Pedro Gomez');

      // Firma digital preservada de Pedro
      expect(resultado.acta.firmas.firmaDigitalBase64).toBe('base64-firma-cliente');
      expect(resultado.acta.firmas.clienteConformidadNombre).toBe('Ing. Sanchez');

      // Observaciones colaborativas combinadas
      expect(resultado.acta.observacionesCliente).toContain('Recibido por guardia sur');
      expect(resultado.acta.observacionesCliente).toContain('oficina central');
    });

    it('preserva una firma manuscrita local válida (Base64 o archivo local) si el acta remota marca responsableNoDisponible: true (F4)', () => {
      const base: ActaServicioDrt = {
        servicioId: 'a0000000-0000-0000-0000-000000000002',
        clienteRazonSocial: 'ALICORP S.A.A.',
        sedeDireccion: 'Planta Callao',
        fecha: '2026-11-03',
        horaInicio: '08:00',
        horaTermino: '10:00',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 10,
        cebosConsumidos: 0,
        cebosRepuestos: 0,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 4,
        trampasActivadas: 0,
        roedoresDetectados: [],
        resultadosRecomendaciones: '',
        observacionesCliente: '',
        firmas: {
          personalResponsableNombre: 'Juan Perez',
          personalResponsableCargo: 'Técnico',
          clienteConformidadNombre: 'Luis Vega',
          clienteConformidadCargo: 'Jefe de Planta',
          fecha: '2026-11-03',
          firmaDigitalBase64: 'data:image/svg+xml;base64,PHN2Zy8+',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [],
        fotos: [],
      };

      const remotaAusente: ActaServicioDrt = {
        ...base,
        firmas: {
          ...base.firmas,
          firmaDigitalBase64: undefined,
          firmaArchivoId: undefined,
          firmaRutaLocalRelativa: undefined,
          responsableNoDisponible: true,
          motivoNoDisponible: 'No ubicó al responsable en su sector',
        },
      };

      // Caso 1: firma local Base64
      const resBase64 = fusionarActasColaborativas(base, remotaAusente);
      expect(resBase64.acta.firmas.firmaDigitalBase64).toBe('data:image/svg+xml;base64,PHN2Zy8+');
      expect(resBase64.acta.firmas.responsableNoDisponible).toBe(false);

      // Caso 2: firma local respaldada por archivo (§13.2 / PR #36)
      const localConArchivo: ActaServicioDrt = {
        ...base,
        firmas: {
          ...base.firmas,
          firmaDigitalBase64: undefined,
          firmaArchivoId: '11111111-1111-4000-8000-000000000099',
          firmaRutaLocalRelativa: 'inspections/INS_1/signatures/SIG_1.svg',
          responsableNoDisponible: false,
        },
      };
      const resArchivo = fusionarActasColaborativas(localConArchivo, remotaAusente);
      expect(resArchivo.acta.firmas.firmaArchivoId).toBe('11111111-1111-4000-8000-000000000099');
      expect(resArchivo.acta.firmas.firmaRutaLocalRelativa).toBe('inspections/INS_1/signatures/SIG_1.svg');
      expect(resArchivo.acta.firmas.responsableNoDisponible).toBe(false);
    });

    it('es idempotente al fusionar observaciones/recomendaciones y no descarta roedoresDetectados ni contadores remotos (F7)', () => {
      const local: ActaServicioDrt = {
        servicioId: 'a0000000-0000-0000-0000-000000000003',
        clienteRazonSocial: 'GLORIA S.A.',
        sedeDireccion: 'Huachipa',
        fecha: '2026-11-03',
        horaInicio: '08:00',
        horaTermino: '11:00',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 20,
        cebosConsumidos: 2,
        cebosRepuestos: 2,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 5,
        trampasActivadas: 1,
        roedoresDetectados: ['R_NORVEGICUS'],
        resultadosRecomendaciones: 'Sector A revisado',
        observacionesCliente: 'Obs A',
        firmas: {
          personalResponsableNombre: 'Juan',
          personalResponsableCargo: 'Técnico',
          clienteConformidadNombre: '',
          clienteConformidadCargo: '',
          fecha: '2026-11-03',
          responsableNoDisponible: false,
        },
        planillaEstaciones: [],
        fotos: [],
        actualizadoEn: '2026-11-03T09:00:00Z',
      };

      const remota: ActaServicioDrt = {
        ...local,
        cebosInstalados: 30,
        cebosConsumidos: 6,
        cebosRepuestos: 6,
        trampasInstaladas: 8,
        trampasActivadas: 3,
        roedoresDetectados: ['R_NORVEGICUS', 'MUS_MUSCULUS'],
        resultadosRecomendaciones: 'Sector B revisado',
        observacionesCliente: 'Obs B',
        actualizadoEn: '2026-11-03T09:30:00Z',
      };

      const primera = fusionarActasColaborativas(local, remota);
      expect(primera.acta.observacionesCliente).toBe('Obs A | Obs B');
      expect(primera.acta.resultadosRecomendaciones).toBe('Sector A revisado | Sector B revisado');
      expect(primera.acta.roedoresDetectados).toEqual(['R_NORVEGICUS', 'MUS_MUSCULUS']);
      expect(primera.acta.cebosInstalados).toBe(30);
      expect(primera.acta.cebosConsumidos).toBe(6);
      expect(primera.acta.cebosRepuestos).toBe(6);
      expect(primera.acta.trampasInstaladas).toBe(8);
      expect(primera.acta.trampasActivadas).toBe(3);

      // Re-sincronizar con el mismo payload remoto debe ser idempotente (sin duplicar "| Obs B")
      const segunda = fusionarActasColaborativas(primera.acta, remota);
      expect(segunda.acta.observacionesCliente).toBe('Obs A | Obs B');
      expect(segunda.acta.resultadosRecomendaciones).toBe('Sector A revisado | Sector B revisado');
      expect(segunda.acta.roedoresDetectados).toEqual(['R_NORVEGICUS', 'MUS_MUSCULUS']);
    });
  });

  describe('6. Formato de Detalle de Guardado', () => {
    it('formatea texto legible de guardado con técnico, fecha y hora en zona local consistente (F6)', () => {
      const texto = formatearDetalleBorrador('2026-11-03T14:30:00Z', 'Carlos Prado');
      expect(texto).toContain('2026-11-03');
      expect(texto).toContain('Carlos Prado');

      // Guardado nocturno local (ej. 21:45 local -> siguiente día en UTC en zonas con offset negativo como Perú UTC-5):
      // la fecha formateada debe coincidir con el día local, nunca adelantarse 1 día por mezclar UTC y local.
      const fechaNocturnaLocal = new Date(2026, 10, 3, 21, 45, 0);
      const formateado = formatearDetalleBorrador(fechaNocturnaLocal.toISOString(), 'Mario Silva');
      expect(formateado).toBe('Guardado el 2026-11-03 a las 21:45 por Mario Silva');

      expect(formatearDetalleBorrador(undefined, 'Mario Silva')).toBe('Borrador sin guardar');
    });
  });
});
