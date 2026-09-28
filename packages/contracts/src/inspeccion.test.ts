import { describe, expect, it } from 'vitest';
import {
  CerrarInspeccionSchema,
  ConsumoInsumoSchema,
  CrearInspeccionSchema,
  EstadoInspeccionSchema,
  InspeccionRegistradaSchema,
  InspeccionSchema,
  PorcentajeConsumoSchema,
} from './inspeccion';
import { esperarFallaEn } from './pruebas';

const id = '11111111-1111-1111-1111-111111111111';

describe('PorcentajeConsumoSchema (Spec Mapas §5.1)', () => {
  it.each([0, 25, 50, 75, 100])('acepta %i', (p) => expect(PorcentajeConsumoSchema.safeParse(p).success).toBe(true));
  it.each([-25, 10, 26, 101, 12.5, '50'])('rechaza %j', (p) => expect(PorcentajeConsumoSchema.safeParse(p).success).toBe(false));
});

describe('InspeccionRegistradaSchema (Spec Mapas §5.1)', () => {
  const base = {
    fecha: '2026-09-20',
    tipoCebo: 'Bloque parafinado',
    cantidadGramos: 20,
    lote: 'L-2026-04',
    vencimiento: '2027-04-30',
    huboConsumo: true,
    porcentajeConsumo: 50,
    cantidadReposicion: 20,
  };
  it('acepta una inspección con consumo', () => expect(InspeccionRegistradaSchema.safeParse(base).success).toBe(true));
  it('acepta una inspección sin consumo con estado físico y cantidad repuesta', () => {
    const { porcentajeConsumo: _p, cantidadReposicion: _c, ...sin } = base;
    expect(InspeccionRegistradaSchema.safeParse({ ...sin, huboConsumo: false, estadoFisico: 'MALAS_CONDICIONES', cantidadRepuesta: 20 }).success).toBe(true);
  });
  it('rechaza porcentaje fuera de los cinco valores, estado físico y cantidades inválidas', () => {
    esperarFallaEn(InspeccionRegistradaSchema, { ...base, porcentajeConsumo: 60 }, 'porcentajeConsumo');
    esperarFallaEn(InspeccionRegistradaSchema, { ...base, estadoFisico: 'ROTA' }, 'estadoFisico');
    esperarFallaEn(InspeccionRegistradaSchema, { ...base, cantidadGramos: -1 }, 'cantidadGramos');
    esperarFallaEn(InspeccionRegistradaSchema, { ...base, vencimiento: '2027-13-01' }, 'vencimiento');
  });
});

describe('EstadoInspeccionSchema', () => {
  it('no incluye ENVIADO, que es un estado del documento y no de la inspección', () => {
    expect(EstadoInspeccionSchema.options).toEqual(['BORRADOR', 'CERRADO', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO']);
  });
});

const inspeccion = {
  id,
  servicioId: '22222222-2222-2222-2222-222222222222',
  codigoInspeccion: 'GAFER-2026-KALLPA-001',
  estado: 'BORRADOR',
  versionSync: 1,
  fechaEjecucion: '2026-09-28',
  horaInicio: '08:00',
  horaFin: null,
  tecnicosParticipantes: [{ id: '33333333-3333-3333-3333-333333333333', nombre: 'Luis Quispe' }],
  snapshotCatalogos: {},
};

describe('InspeccionSchema (Spec §13)', () => {
  it('acepta una inspección en borrador', () => expect(InspeccionSchema.safeParse(inspeccion).success).toBe(true));
  it('rechaza versión de sincronización menor que 1 o fraccionaria', () => {
    esperarFallaEn(InspeccionSchema, { ...inspeccion, versionSync: 0 }, 'versionSync');
    esperarFallaEn(InspeccionSchema, { ...inspeccion, versionSync: 1.5 }, 'versionSync');
  });
  it('rechaza código vacío, fecha mal formada y técnico sin UUID', () => {
    esperarFallaEn(InspeccionSchema, { ...inspeccion, codigoInspeccion: '' }, 'codigoInspeccion');
    esperarFallaEn(InspeccionSchema, { ...inspeccion, fechaEjecucion: '28-09-2026' }, 'fechaEjecucion');
    esperarFallaEn(InspeccionSchema, { ...inspeccion, tecnicosParticipantes: [{ id: 't', nombre: 'Luis' }] }, 'tecnicosParticipantes.0.id');
  });
  it('rechaza estado desconocido', () => esperarFallaEn(InspeccionSchema, { ...inspeccion, estado: 'ENVIADO' }, 'estado'));
});

describe('CerrarInspeccionSchema (Spec §13)', () => {
  const consumo = { insumoId: id, dosisAplicada: '10 ml/L', lote: 'LOTE-2026-X', cantidadUtilizada: 2.5 };
  it('acepta un cierre sin nada adicional y uno completo', () => {
    expect(CerrarInspeccionSchema.safeParse({}).success).toBe(true);
    expect(CerrarInspeccionSchema.safeParse({ consumos: [consumo], equiposIds: [id], personalIds: [id] }).success).toBe(true);
  });
  it('rechaza cantidad utilizada de 0 (mínimo 0.01) y lote vacío', () => {
    esperarFallaEn(ConsumoInsumoSchema, { ...consumo, cantidadUtilizada: 0 }, 'cantidadUtilizada');
    expect(ConsumoInsumoSchema.safeParse({ ...consumo, cantidadUtilizada: 0.01 }).success).toBe(true);
    esperarFallaEn(ConsumoInsumoSchema, { ...consumo, lote: '' }, 'lote');
  });
  it('rechaza ids de equipo no UUID', () => esperarFallaEn(CerrarInspeccionSchema, { equiposIds: ['e1'] }, 'equiposIds.0'));
});

describe('CrearInspeccionSchema', () => {
  it('acepta el id de un servicio contratado', () => expect(CrearInspeccionSchema.safeParse({ servicioId: id }).success).toBe(true));
  it('rechaza un servicio ausente o sin formato UUID', () => {
    esperarFallaEn(CrearInspeccionSchema, {}, 'servicioId');
    esperarFallaEn(CrearInspeccionSchema, { servicioId: 's1' }, 'servicioId');
  });
});
