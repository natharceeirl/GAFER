import { describe, it, expect } from 'vitest';
import {
  calcularConsumoGramos,
  crearEstacionDrt,
  aplicarPrimeraVisita,
  actualizarConsumoEstacion,
  actualizarEstadoFisicoEstacion,
  copiarCeboALote,
  validarEstacionesPlanilla,
  generarOperacionesSyncEstaciones,
  PORCENTAJES_CONSUMO,
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
    it('en primera visita (instalación), marca esInstalacion y no evalúa consumo', () => {
      const estaciones = [
        crearEstacionDrt(1, { huboConsumo: true, porcentajeConsumo: 50, consumoGramos: 10 }),
        crearEstacionDrt(2, { huboConsumo: true, porcentajeConsumo: 25, consumoGramos: 5 }),
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
        expect(est.estado).toBe('SIN_ACTIVIDAD');
        expect(est.lote).toBe('LOTE-INSTALACION');
        expect(est.estadoFisico).toBe('BUENAS_CONDICIONES');
      }
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
  });

  describe('generarOperacionesSyncEstaciones', () => {
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
    });
  });
});
