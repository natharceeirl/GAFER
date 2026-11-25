import { describe, expect, it } from 'vitest';
import { MONTO_MAXIMO } from './comun';
import {
  FrecuenciaServicioSchema,
  ServicioContratadoActualizacionSchema,
  ServicioContratadoDetalleSchema,
  ServicioContratadoRegistroSchema,
} from './servicio';
import { esperarFallaEn, rutasInvalidas } from './pruebas';

const registro = {
  proyectoId: '11111111-1111-1111-1111-111111111111',
  tipoServicio: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotalM2: 500,
  areaTratarM2: 300,
  insumosAutorizados: ['22222222-2222-2222-2222-222222222222'],
  equiposAutorizados: ['33333333-3333-3333-3333-333333333333'],
  dosisReferencial: { '22222222-2222-2222-2222-222222222222': '1 bloque por estación' },
  requiereCertificado: false,
};

describe('FrecuenciaServicioSchema', () => {
  it('acepta las 9 frecuencias del catálogo', () => {
    for (const f of ['DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PUNTUAL']) {
      expect(FrecuenciaServicioSchema.safeParse(f).success).toBe(true);
    }
  });
  it('rechaza etiquetas de pantalla en lugar del código', () => expect(FrecuenciaServicioSchema.safeParse('Quincenal').success).toBe(false));
});

describe('ServicioContratadoRegistroSchema (Spec §7.3)', () => {
  it('acepta un servicio válido sin certificado', () => expect(ServicioContratadoRegistroSchema.safeParse(registro).success).toBe(true));

  it('acepta área a tratar igual al área total (borde)', () => {
    expect(ServicioContratadoRegistroSchema.safeParse({ ...registro, areaTratarM2: 500 }).success).toBe(true);
  });

  it('rechaza un área a tratar mayor que el área total, señalando el área a tratar', () => {
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, areaTratarM2: 500.01 }, 'areaTratarM2');
  });

  it('rechaza áreas en cero o negativas', () => {
    expect(rutasInvalidas(ServicioContratadoRegistroSchema, { ...registro, areaTotalM2: 0, areaTratarM2: 0 })).toEqual(
      expect.arrayContaining(['areaTotalM2', 'areaTratarM2']),
    );
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, areaTratarM2: -1 }, 'areaTratarM2');
  });

  it('exige vigencia en días si el servicio requiere certificado', () => {
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, requiereCertificado: true }, 'vigenciaDias');
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, requiereCertificado: true, vigenciaDias: 0 }, 'vigenciaDias');
    expect(ServicioContratadoRegistroSchema.safeParse({ ...registro, requiereCertificado: true, vigenciaDias: 180 }).success).toBe(true);
  });

  it('rechaza tipo de servicio desconocido, insumos no UUID y dosis no textuales', () => {
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, tipoServicio: 'XYZ' }, 'tipoServicio');
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, insumosAutorizados: ['i1'] }, 'insumosAutorizados.0');
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, dosisReferencial: { a: 3 } }, 'dosisReferencial.a');
  });
});

describe('ServicioContratadoDetalleSchema', () => {
  it('exige id y estado, y conserva las reglas de área', () => {
    const detalle = { ...registro, id: '44444444-4444-4444-4444-444444444444', estado: 'ACTIVO' };
    expect(ServicioContratadoDetalleSchema.safeParse(detalle).success).toBe(true);
    esperarFallaEn(ServicioContratadoDetalleSchema, { ...detalle, areaTratarM2: 9999 }, 'areaTratarM2');
    esperarFallaEn(ServicioContratadoDetalleSchema, { ...detalle, id: 'x' }, 'id');
  });
});

describe('ServicioContratadoActualizacionSchema', () => {
  it('acepta actualización parcial válida', () => {
    const res = ServicioContratadoActualizacionSchema.safeParse({
      frecuencia: 'MENSUAL',
      areaTotalM2: 600,
      areaTratarM2: 400,
    });
    expect(res.success).toBe(true);
  });

  it('rechaza si areaTratarM2 > areaTotalM2 en la actualización', () => {
    esperarFallaEn(
      ServicioContratadoActualizacionSchema,
      { areaTotalM2: 100, areaTratarM2: 150 },
      'areaTratarM2',
    );
  });

  it('exige vigencia si requiereCertificado es true en la actualización', () => {
    esperarFallaEn(
      ServicioContratadoActualizacionSchema,
      { requiereCertificado: true },
      'vigenciaDias',
    );
  });
});

describe('Montos y pagos opcionales en servicio contratado (GAF-105)', () => {
  it('acepta monto positivo o cero con moneda PEN o USD', () => {
    expect(
      ServicioContratadoRegistroSchema.safeParse({
        ...registro,
        monto: 1500.5,
        moneda: 'PEN',
      }).success,
    ).toBe(true);

    expect(
      ServicioContratadoActualizacionSchema.safeParse({
        monto: 500,
        moneda: 'USD',
      }).success,
    ).toBe(true);
  });

  it('permite registrar o actualizar dejando el monto y moneda vacíos o nulos', () => {
    expect(
      ServicioContratadoRegistroSchema.safeParse({
        ...registro,
        monto: null,
        moneda: null,
      }).success,
    ).toBe(true);

    expect(
      ServicioContratadoActualizacionSchema.safeParse({
        monto: undefined,
        moneda: undefined,
      }).success,
    ).toBe(true);
  });

  it('rechaza montos negativos o monedas no soportadas', () => {
    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, monto: -10, moneda: 'PEN' },
      'monto',
    );
    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, moneda: 'EUR' },
      'moneda',
    );
  });

  it('acota el monto al máximo de NUMERIC(12, 2) y rechaza valores no finitos (F1)', () => {
    expect(
      ServicioContratadoRegistroSchema.safeParse({
        ...registro,
        monto: MONTO_MAXIMO,
        moneda: 'PEN',
      }).success,
    ).toBe(true);

    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, monto: 10_000_000_000, moneda: 'PEN' },
      'monto',
    );
    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, monto: Number.POSITIVE_INFINITY, moneda: 'USD' },
      'monto',
    );
    esperarFallaEn(
      ServicioContratadoActualizacionSchema,
      { monto: 10_000_000_000, moneda: 'PEN' },
      'monto',
    );
  });

  it('valida la consistencia cruzada entre monto y moneda (F2)', () => {
    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, monto: 500 },
      'moneda',
    );
    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, monto: 500, moneda: null },
      'moneda',
    );
    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, moneda: 'USD' },
      'moneda',
    );
    esperarFallaEn(
      ServicioContratadoRegistroSchema,
      { ...registro, monto: null, moneda: 'PEN' },
      'moneda',
    );
    esperarFallaEn(
      ServicioContratadoDetalleSchema,
      { ...registro, id: '44444444-4444-4444-4444-444444444444', estado: 'ACTIVO', monto: 500 },
      'moneda',
    );
    esperarFallaEn(
      ServicioContratadoActualizacionSchema,
      { monto: 500, moneda: null },
      'moneda',
    );
    esperarFallaEn(
      ServicioContratadoActualizacionSchema,
      { monto: null, moneda: 'USD' },
      'moneda',
    );
    expect(
      ServicioContratadoActualizacionSchema.safeParse({ monto: null, moneda: null }).success,
    ).toBe(true);
  });
});

describe('servicio: monto con más de 2 decimales', () => {
  it('rechaza monto con 3 decimales en el registro y en la actualización, señalando el campo', () => {
    esperarFallaEn(ServicioContratadoRegistroSchema, { ...registro, monto: 10.999, moneda: 'PEN' }, 'monto');
    esperarFallaEn(ServicioContratadoActualizacionSchema, { monto: 10.999, moneda: 'PEN' }, 'monto');
  });

  it('acepta monto con 2 decimales', () => {
    expect(ServicioContratadoRegistroSchema.safeParse({ ...registro, monto: 10.99, moneda: 'PEN' }).success).toBe(true);
  });
});
