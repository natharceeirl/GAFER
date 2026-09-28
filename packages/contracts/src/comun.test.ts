import { describe, expect, it } from 'vitest';
import { DniSchema, FechaSchema, HoraSchema, PaginacionQuerySchema, RucSchema, TelefonoSchema } from './comun';

describe('RucSchema', () => {
  it('acepta 11 dígitos', () => expect(RucSchema.safeParse('20508565434').success).toBe(true));
  it.each(['2050856543', '205085654345', '2050856543A', ' 20508565434', ''])('rechaza %j', (v) =>
    expect(RucSchema.safeParse(v).success).toBe(false),
  );
});

describe('DniSchema', () => {
  it('acepta 8 dígitos', () => expect(DniSchema.safeParse('45678912').success).toBe(true));
  it.each(['4567891', '456789123', 'abcdefgh'])('rechaza %j', (v) => expect(DniSchema.safeParse(v).success).toBe(false));
});

describe('FechaSchema', () => {
  it('acepta AAAA-MM-DD reales, incluido 29 de febrero bisiesto', () => {
    expect(FechaSchema.safeParse('2026-09-28').success).toBe(true);
    expect(FechaSchema.safeParse('2028-02-29').success).toBe(true);
  });
  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '28/09/2026', '2026-9-8', '2026-09-28T10:00:00Z'])(
    'rechaza %j',
    (v) => expect(FechaSchema.safeParse(v).success).toBe(false),
  );
});

describe('HoraSchema', () => {
  it.each(['00:00', '08:30', '23:59'])('acepta %j', (v) => expect(HoraSchema.safeParse(v).success).toBe(true));
  it.each(['24:00', '12:60', '8:30', '08:30:00', ''])('rechaza %j', (v) => expect(HoraSchema.safeParse(v).success).toBe(false));
});

describe('TelefonoSchema', () => {
  it('acepta formatos habituales', () => {
    expect(TelefonoSchema.safeParse('958123456').success).toBe(true);
    expect(TelefonoSchema.safeParse('+51 (054) 123-456').success).toBe(true);
  });
  it('rechaza letras o menos de 6 dígitos', () => {
    expect(TelefonoSchema.safeParse('95812a').success).toBe(false);
    expect(TelefonoSchema.safeParse('12345').success).toBe(false);
  });
  it('los rechazos se conservan aunque el dato traiga espacios extremos vacíos', () => {
    expect(TelefonoSchema.safeParse('   ').success).toBe(false);
  });
});

describe('PaginacionQuerySchema', () => {
  it('aplica 20 registros desde el inicio cuando la consulta no indica nada', () => {
    expect(PaginacionQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
  });
  it('convierte los números que llegan como texto en la URL', () => {
    expect(PaginacionQuerySchema.parse({ limit: '50', offset: '100', busqueda: 'KALLPA' })).toEqual({
      limit: 50,
      offset: 100,
      busqueda: 'KALLPA',
    });
  });
  it.each([{ limit: '0' }, { limit: '101' }, { limit: '1.5' }, { limit: 'abc' }, { offset: '-1' }])('rechaza %j', (consulta) =>
    expect(PaginacionQuerySchema.safeParse(consulta).success).toBe(false),
  );
});
