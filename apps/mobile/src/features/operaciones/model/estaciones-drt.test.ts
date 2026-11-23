import { describe, it, expect } from 'vitest';
import {
  calcularConsumoGramos,
  crearEstacionDrt,
  aplicarPrimeraVisita,
  actualizarConsumoEstacion,
  actualizarEstadoEstacion,
  actualizarCantidadGramosEstacion,
  actualizarEstadoFisicoEstacion,
  copiarCeboALote,
  validarEstacionesPlanilla,
  construirPayloadEstacionSync,
  generarOperacionesSyncEstaciones,
  PORCENTAJES_CONSUMO,
  PORCENTAJES_CON_CONSUMO,
} from './estaciones-drt';
import {
  OperacionSyncSchema,
  PayloadEstacionSyncSchema,
} from '@gafer/contracts';

describe('Estaciones DRT (§5.1, GAF-35)', () => {
  describe('calcularConsumoGramos', () => {
    it('calcula los gramos consumidos para cada porcentaje permitido (0, 25, 50, 75, 100)', () => {
      const gramosBase = 20;
      expect(calcularConsumoGramos(gramosBase, 0)).toBe(0);
      expect(calcularConsumoGramos(gramosBase, 25)).toBe(5);
      expect(calcularConsumoGramos(gramosBase, 50)).toBe(10);
      expect(calcularConsumoGramos(gramosBase, 75)).toBe(15);
      expect(calcularConsumoGramos(gramosBase, 100)).toBe(20);
    });

    it('redondea correctamente decimales si la dosis base produce fracciones', () => {
      const gramosBase = 15;
      expect(calcularConsumoGramos(gramosBase, 25)).toBe(3.75);
      expect(calcularConsumoGramos(gramosBase, 50)).toBe(7.5);
      expect(calcularConsumoGramos(gramosBase, 75)).toBe(11.25);
    });

    it('devuelve 0 si la dosis base o el porcentaje es 0 o negativo', () => {
      expect(calcularConsumoGramos(0, 50)).toBe(0);
      expect(calcularConsumoGramos(-10, 50)).toBe(0);
    });
  });

  describe('crearEstacionDrt', () => {
    it('crea una estación con valores válidos por defecto', () => {
      const est = crearEstacionDrt(1);
      expect(est.numero).toBe(1);
      expect(est.estado).toBe('SIN_ACTIVIDAD');
      expect(est.tipoCebo).toBe('BLOQUE_10G');
      expect(est.cantidadGramos).toBe(20);
      expect(est.lote).toBe('LOTE-001');
      expect(est.vencimiento).toBe('2026-12-31');
      expect(est.huboConsumo).toBe(false);
      expect(est.porcentajeConsumo).toBe(0);
      expect(est.consumoGramos).toBe(0);
      expect(est.repuestoGramos).toBe(0);
      expect(est.cantidadReposicion).toBe(0);
      expect(est.estadoFisico).toBe('BUENAS_CONDICIONES');
      expect(est.esInstalacion).toBe(false);
    });

    it('permite sobreescribir valores iniciales con config personalizada', () => {
      const est = crearEstacionDrt(5, {
        tipoCebo: 'PASTA',
        cantidadGramos: 15,
        lote: 'L-GAF-99',
        vencimiento: '2027-05-01',
      });
      expect(est.numero).toBe(5);
      expect(est.tipoCebo).toBe('PASTA');
      expect(est.cantidadGramos).toBe(15);
      expect(est.lote).toBe('L-GAF-99');
      expect(est.vencimiento).toBe('2027-05-01');
    });
  });

  describe('aplicarPrimeraVisita', () => {
    it('en primera visita (instalación), marca esInstalacion, no evalúa consumo y usa ceboDefecto solo para campos faltantes', () => {
      const estaciones = [
        { numero: 1, estado: 'CON_CONSUMO' as const, huboConsumo: true, porcentajeConsumo: 50 as const, consumoGramos: 10 },
        { numero: 2, estado: 'CON_CONSUMO' as const, huboConsumo: true, porcentajeConsumo: 25 as const, consumoGramos: 5 },
      ];

      const resultado = aplicarPrimeraVisita(estaciones, true, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'LOTE-INSTALACION',
        vencimiento: '2026-12-31',
      });

      expect(resultado).toHaveLength(2);
      for (const est of resultado) {
        expect(est.esInstalacion).toBe(true);
        expect(est.huboConsumo).toBe(false);
        expect(est.porcentajeConsumo).toBe(0);
        expect(est.consumoGramos).toBe(0);
        expect(est.repuestoGramos).toBe(0);
        expect(est.cantidadReposicion).toBe(0);
        expect(est.estado).toBe('SIN_ACTIVIDAD');
        expect(est.tipoCebo).toBe('BLOQUE_10G');
        expect(est.cantidadGramos).toBe(20);
        expect(est.lote).toBe('LOTE-INSTALACION');
        expect(est.estadoFisico).toBe('BUENAS_CONDICIONES');
      }
    });

    it('preserva tipoCebo, cantidadGramos, lote y vencimiento personalizados de cada estación al activar primera visita (F4)', () => {
      const estaciones = [
        crearEstacionDrt(1, {
          tipoCebo: 'PASTA',
          cantidadGramos: 40,
          lote: 'L-PASTA-99',
          vencimiento: '2027-08-15',
          huboConsumo: true,
          porcentajeConsumo: 50,
          consumoGramos: 20,
        }),
        crearEstacionDrt(2, {
          tipoCebo: 'PELLETS',
          cantidadGramos: 30,
          lote: 'L-PELLET-02',
          vencimiento: '2027-09-01',
        }),
      ];

      const resultado = aplicarPrimeraVisita(estaciones, true, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'LOTE-DEFECTO',
        vencimiento: '2026-12-31',
      });

      expect(resultado[0].esInstalacion).toBe(true);
      expect(resultado[0].huboConsumo).toBe(false);
      expect(resultado[0].consumoGramos).toBe(0);
      expect(resultado[0].tipoCebo).toBe('PASTA');
      expect(resultado[0].cantidadGramos).toBe(40);
      expect(resultado[0].lote).toBe('L-PASTA-99');
      expect(resultado[0].vencimiento).toBe('2027-08-15');

      expect(resultado[1].tipoCebo).toBe('PELLETS');
      expect(resultado[1].cantidadGramos).toBe(30);
      expect(resultado[1].lote).toBe('L-PELLET-02');
      expect(resultado[1].vencimiento).toBe('2027-09-01');
    });

    it('en visitas regulares (esPrimera = false), marca esInstalacion = false', () => {
      const estaciones = [crearEstacionDrt(1, { esInstalacion: true })];
      const resultado = aplicarPrimeraVisita(estaciones, false);
      expect(resultado[0].esInstalacion).toBe(false);
    });
  });

  describe('actualizarConsumoEstacion', () => {
    it('cuando huboConsumo es false, resetea porcentajes y gramos a 0', () => {
      const estPrevia = crearEstacionDrt(1, {
        huboConsumo: true,
        porcentajeConsumo: 50,
        consumoGramos: 10,
        repuestoGramos: 10,
        estado: 'CON_CONSUMO',
      });

      const actualizada = actualizarConsumoEstacion(estPrevia, false);
      expect(actualizada.huboConsumo).toBe(false);
      expect(actualizada.porcentajeConsumo).toBe(0);
      expect(actualizada.consumoGramos).toBe(0);
      expect(actualizada.repuestoGramos).toBe(0);
      expect(actualizada.cantidadReposicion).toBe(0);
      expect(actualizada.estado).toBe('SIN_ACTIVIDAD');
    });

    it('cuando porcentaje es 0 aunque huboConsumo sea true, normaliza a sin consumo (F2)', () => {
      const estPrevia = actualizarConsumoEstacion(crearEstacionDrt(1, { cantidadGramos: 20 }), true, 50);
      const actualizada = actualizarConsumoEstacion(estPrevia, true, 0);

      expect(actualizada.huboConsumo).toBe(false);
      expect(actualizada.porcentajeConsumo).toBe(0);
      expect(actualizada.consumoGramos).toBe(0);
      expect(actualizada.repuestoGramos).toBe(0);
      expect(actualizada.cantidadReposicion).toBe(0);
      expect(actualizada.estado).toBe('SIN_ACTIVIDAD');
    });

    it('cuando huboConsumo es true, calcula gramos consumidos y reposición al porcentaje indicado', () => {
      const estPrevia = crearEstacionDrt(1, { cantidadGramos: 40 });
      const actualizada = actualizarConsumoEstacion(estPrevia, true, 75);

      expect(actualizada.huboConsumo).toBe(true);
      expect(actualizada.porcentajeConsumo).toBe(75);
      expect(actualizada.consumoGramos).toBe(30);
      expect(actualizada.repuestoGramos).toBe(30);
      expect(actualizada.cantidadReposicion).toBe(30);
      expect(actualizada.estado).toBe('CON_CONSUMO');
    });
  });

  describe('actualizarEstadoEstacion (F2)', () => {
    it('al cambiar una estación con consumo a SIN_ACCESO, EXTRAVIADA o SIN_ACTIVIDAD limpia huboConsumo y gramos', () => {
      const conConsumo = actualizarConsumoEstacion(crearEstacionDrt(1, { cantidadGramos: 20 }), true, 50);
      expect(conConsumo.consumoGramos).toBe(10);

      for (const estadoDestino of ['SIN_ACCESO', 'EXTRAVIADA', 'SIN_ACTIVIDAD'] as const) {
        const res = actualizarEstadoEstacion(conConsumo, estadoDestino);
        expect(res.estado).toBe(estadoDestino);
        expect(res.huboConsumo).toBe(false);
        expect(res.porcentajeConsumo).toBe(0);
        expect(res.consumoGramos).toBe(0);
        expect(res.repuestoGramos).toBe(0);
        expect(res.cantidadReposicion).toBe(0);
      }
    });

    it('al seleccionar CON_CONSUMO desde SIN_ACTIVIDAD habilita huboConsumo y asigna porcentaje inicial 25%', () => {
      const inicial = crearEstacionDrt(1, { cantidadGramos: 20 });
      const res = actualizarEstadoEstacion(inicial, 'CON_CONSUMO');

      expect(res.estado).toBe('CON_CONSUMO');
      expect(res.huboConsumo).toBe(true);
      expect(res.porcentajeConsumo).toBe(25);
      expect(res.consumoGramos).toBe(5);
      expect(res.repuestoGramos).toBe(5);
      expect(res.cantidadReposicion).toBe(5);
    });
  });

  describe('actualizarCantidadGramosEstacion (F1)', () => {
    it('recalcula consumoGramos, repuestoGramos y cantidadReposicion al cambiar gramos base', () => {
      const est = actualizarConsumoEstacion(crearEstacionDrt(1, { cantidadGramos: 20 }), true, 50);
      expect(est.consumoGramos).toBe(10);
      expect(est.cantidadReposicion).toBe(10);

      const actualizada = actualizarCantidadGramosEstacion(est, 40);
      expect(actualizada.cantidadGramos).toBe(40);
      expect(actualizada.consumoGramos).toBe(20);
      expect(actualizada.repuestoGramos).toBe(20);
      expect(actualizada.cantidadReposicion).toBe(20);
    });
  });

  describe('actualizarEstadoFisicoEstacion', () => {
    it('actualiza el estado físico y las observaciones asociadas', () => {
      const est = crearEstacionDrt(1);
      const conDanio = actualizarEstadoFisicoEstacion(
        est,
        'MALAS_CONDICIONES',
        'Tapa rota por montacarga',
      );

      expect(conDanio.estadoFisico).toBe('MALAS_CONDICIONES');
      expect(conDanio.observaciones).toBe('Tapa rota por montacarga');
    });
  });

  describe('copiarCeboALote', () => {
    it('propaga cebo, lote y vencimiento a todas las estaciones de la planilla', () => {
      const estaciones = [crearEstacionDrt(1), crearEstacionDrt(2), crearEstacionDrt(3)];

      const actualizadas = copiarCeboALote(estaciones, {
        tipoCebo: 'PELLETS',
        cantidadGramos: 30,
        lote: 'L-2026-X1',
        vencimiento: '2027-01-15',
      });

      for (const est of actualizadas) {
        expect(est.tipoCebo).toBe('PELLETS');
        expect(est.cantidadGramos).toBe(30);
        expect(est.lote).toBe('L-2026-X1');
        expect(est.vencimiento).toBe('2027-01-15');
      }
    });

    it('recalcula gramos consumidos en estaciones que ya tenían consumo', () => {
      const estaciones = [
        actualizarConsumoEstacion(crearEstacionDrt(1, { cantidadGramos: 20 }), true, 50), // Consumo era 10g
      ];

      const actualizadas = copiarCeboALote(estaciones, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 40,
        lote: 'L-NUEVO',
        vencimiento: '2027-01-15',
      });

      expect(actualizadas[0].cantidadGramos).toBe(40);
      expect(actualizadas[0].consumoGramos).toBe(20); // 50% de 40g = 20g
      expect(actualizadas[0].cantidadReposicion).toBe(20);
    });
  });

  describe('validarEstacionesPlanilla', () => {
    it('pasa exitosamente para estaciones bien configuradas en primera visita', () => {
      const estaciones = [
        crearEstacionDrt(1, { esInstalacion: true, estadoFisico: 'BUENAS_CONDICIONES' }),
        crearEstacionDrt(2, { esInstalacion: true, estadoFisico: 'BUENAS_CONDICIONES' }),
      ];

      const res = validarEstacionesPlanilla(estaciones, true);
      expect(res.valido).toBe(true);
      expect(res.errores).toHaveLength(0);
    });

    it('pasa exitosamente para estaciones en visita regular con consumo registrado', () => {
      const estaciones = [
        actualizarConsumoEstacion(crearEstacionDrt(1), false),
        actualizarConsumoEstacion(crearEstacionDrt(2), true, 50),
      ];

      const res = validarEstacionesPlanilla(estaciones, false);
      expect(res.valido).toBe(true);
      expect(res.errores).toHaveLength(0);
    });

    it('falla si la planilla está vacía', () => {
      const res = validarEstacionesPlanilla([]);
      expect(res.valido).toBe(false);
      expect(res.errores[0]).toContain('al menos una estación');
    });

    it('falla si falta tipo de cebo, lote o vencimiento', () => {
      const estIncompleta = {
        ...crearEstacionDrt(1),
        tipoCebo: '',
        lote: '',
        vencimiento: 'fecha-invalida',
      };

      const res = validarEstacionesPlanilla([estIncompleta], false);
      expect(res.valido).toBe(false);
      expect(res.errores.some((e) => e.includes('tipo de cebo'))).toBe(true);
      expect(res.errores.some((e) => e.includes('lote'))).toBe(true);
      expect(res.errores.some((e) => e.includes('fecha de vencimiento válida'))).toBe(true);
    });

    it('falla si estadoFisico es MALAS_CONDICIONES y no tiene observaciones', () => {
      const estSinObs = crearEstacionDrt(1, {
        estadoFisico: 'MALAS_CONDICIONES',
        observaciones: '',
      });

      const res = validarEstacionesPlanilla([estSinObs], false);
      expect(res.valido).toBe(false);
      expect(res.errores.some((e) => e.includes('detallar el daño en observaciones'))).toBe(true);
    });

    it('falla si la estación está EXTRAVIADA o SIN_ACCESO y no tiene observaciones', () => {
      const estSinObs = crearEstacionDrt(1, {
        estado: 'SIN_ACCESO',
        observaciones: '',
      });

      const res = validarEstacionesPlanilla([estSinObs], false);
      expect(res.valido).toBe(false);
      expect(res.errores.some((e) => e.includes('motivo en observaciones'))).toBe(true);
    });

    it('rechaza contradicciones entre estado de estación y consumo o porcentaje 0% (F2)', () => {
      expect(PORCENTAJES_CONSUMO).toContain(0);
      expect(PORCENTAJES_CON_CONSUMO).not.toContain(0);

      const sinAccesoConConsumo = crearEstacionDrt(1, {
        estado: 'SIN_ACCESO',
        huboConsumo: true,
        porcentajeConsumo: 50,
        consumoGramos: 10,
        observaciones: 'Candado cerrado',
      });
      const res1 = validarEstacionesPlanilla([sinAccesoConConsumo], false);
      expect(res1.valido).toBe(false);
      expect(res1.errores.some((e) => e.includes('incompatible con registro de consumo'))).toBe(true);

      const conConsumoSinFlag = crearEstacionDrt(2, {
        estado: 'CON_CONSUMO',
        huboConsumo: false,
        porcentajeConsumo: 0,
      });
      const res2 = validarEstacionesPlanilla([conConsumoSinFlag], false);
      expect(res2.valido).toBe(false);
      expect(res2.errores.some((e) => e.includes('CON_CONSUMO requiere confirmar consumo'))).toBe(true);

      const consumoCeroPorciento = crearEstacionDrt(3, {
        estado: 'CON_CONSUMO',
        huboConsumo: true,
        porcentajeConsumo: 0,
        consumoGramos: 0,
      });
      const res3 = validarEstacionesPlanilla([consumoCeroPorciento], false);
      expect(res3.valido).toBe(false);
      expect(res3.errores.some((e) => e.includes('porcentaje mayor a 0%'))).toBe(true);
    });
  });

  describe('construirPayloadEstacionSync y generarOperacionesSyncEstaciones (F3)', () => {
    it('genera operaciones sync válidas que satisfacen OperacionSyncSchema y PayloadEstacionSyncSchema', () => {
      const servicioId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
      const tecnicoId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
      const estaciones = [
        crearEstacionDrt(1, {
          tipoCebo: 'BLOQUE_10G',
          cantidadGramos: 20,
          lote: 'L-2024-01',
          vencimiento: '2026-10-10',
          huboConsumo: false,
          porcentajeConsumo: 0,
          estadoFisico: 'BUENAS_CONDICIONES',
        }),
        actualizarConsumoEstacion(
          crearEstacionDrt(2, {
            tipoCebo: 'BLOQUE_10G',
            cantidadGramos: 20,
            lote: 'L-2024-01',
            vencimiento: '2026-10-10',
          }),
          true,
          50,
        ),
      ];

      const operaciones = generarOperacionesSyncEstaciones(servicioId, tecnicoId, estaciones);
      expect(operaciones).toHaveLength(2);

      for (const op of operaciones) {
        expect(() => OperacionSyncSchema.parse(op)).not.toThrow();
        expect(op.tipo).toBe('REGISTRO_ESTACION');
        expect(op.agregadoId).toBe(servicioId);
        expect(op.actorId).toBe(tecnicoId);
        expect(() => PayloadEstacionSyncSchema.parse(op.payload)).not.toThrow();
      }

      // Validar detalles de la estación con consumo
      const payloadEst2 = operaciones[1].payload as any;
      expect(payloadEst2.numeroEstacion).toBe(2);
      expect(payloadEst2.huboConsumo).toBe(true);
      expect(payloadEst2.porcentajeConsumo).toBe(50);
      expect(payloadEst2.consumoGramos).toBe(10);
      expect(payloadEst2.cantidadReposicion).toBe(10);
      expect(payloadEst2.colorIcono).toBe('ROJO');
      expect(payloadEst2.colorAura).toBeUndefined();
    });

    it('no deriva colorAura de estadoFisico y alinea colorIcono cuando huboConsumo viene undefined con estado CON_CONSUMO (F3)', () => {
      const primeraVisitaMalaCond = construirPayloadEstacionSync(
        crearEstacionDrt(1, {
          esInstalacion: true,
          estadoFisico: 'MALAS_CONDICIONES',
          observaciones: 'Carcasa rajada',
        }),
        true,
      );
      expect(primeraVisitaMalaCond.huboConsumo).toBe(false);
      expect(primeraVisitaMalaCond.colorIcono).toBe('VERDE');
      expect(primeraVisitaMalaCond.colorAura).toBe('SIN_COLOR');

      const regularMalaCond = construirPayloadEstacionSync(
        crearEstacionDrt(2, {
          esInstalacion: false,
          huboConsumo: false,
          estadoFisico: 'MALAS_CONDICIONES',
          observaciones: 'Tapa suelta',
        }),
        false,
      );
      expect(regularMalaCond.colorIcono).toBe('VERDE');
      expect(regularMalaCond.colorAura).toBeUndefined();

      // Si huboConsumo viene undefined pero estado es CON_CONSUMO, ambos huboConsumo y colorIcono deben coincidir
      const conConsumoFallback = construirPayloadEstacionSync(
        {
          numero: 3,
          estado: 'CON_CONSUMO',
          consumoGramos: 10,
          repuestoGramos: 10,
        },
        false,
      );
      expect(conConsumoFallback.huboConsumo).toBe(true);
      expect(conConsumoFallback.colorIcono).toBe('ROJO');
      expect(conConsumoFallback.colorAura).toBeUndefined();
    });
  });

  describe('metadatos LWW en mutadores de estaciones (PR37-F5)', () => {
    it('asigna actualizadoEn y actualizadoPor al mutar estado, consumo, gramos, estado físico o replicar cebo', () => {
      const base = crearEstacionDrt(1, { cantidadGramos: 20 });
      expect(base.actualizadoEn).toBeUndefined();

      const meta = { actualizadoEn: '2026-11-03T10:15:00.000Z', actualizadoPor: 'Juan Perez' };
      const conConsumo = actualizarConsumoEstacion(base, true, 50, meta);
      expect(conConsumo.actualizadoEn).toBe(meta.actualizadoEn);
      expect(conConsumo.actualizadoPor).toBe('Juan Perez');

      const conEstado = actualizarEstadoEstacion(conConsumo, 'SIN_ACCESO', {
        actualizadoEn: '2026-11-03T10:20:00.000Z',
        actualizadoPor: 'Pedro Gomez',
      });
      expect(conEstado.actualizadoEn).toBe('2026-11-03T10:20:00.000Z');
      expect(conEstado.actualizadoPor).toBe('Pedro Gomez');

      const conGramos = actualizarCantidadGramosEstacion(base, 40, meta);
      expect(conGramos.actualizadoEn).toBe(meta.actualizadoEn);
      expect(conGramos.actualizadoPor).toBe('Juan Perez');

      const conFisico = actualizarEstadoFisicoEstacion(base, 'MALAS_CONDICIONES', 'Rota', meta);
      expect(conFisico.actualizadoEn).toBe(meta.actualizadoEn);
      expect(conFisico.actualizadoPor).toBe('Juan Perez');

      const replicadas = copiarCeboALote(
        [base],
        { tipoCebo: 'PASTA', cantidadGramos: 30, lote: 'L-1', vencimiento: '2027-01-01' },
        meta,
      );
      expect(replicadas[0].actualizadoEn).toBe(meta.actualizadoEn);
      expect(replicadas[0].actualizadoPor).toBe('Juan Perez');
    });
  });
});
