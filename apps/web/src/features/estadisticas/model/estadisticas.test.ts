import { describe, expect, it } from 'vitest';
import {
  agruparAlertas,
  alertasActivas,
  clientesSinServicio,
  consumoMensual,
  ejecutadosVsProgramados,
  estacionesCriticas,
  filtrarActividades,
  mesesHasta,
  resumenClientes,
  serviciosPorTecnico,
  serviciosPorTipo,
  vencimientosCertificados,
  type EstacionCritica,
  type ServicioRegistro,
} from './estadisticas';

const s = (p: Partial<ServicioRegistro> & Pick<ServicioRegistro, 'id' | 'fecha'>): ServicioRegistro => ({
  clienteId: 'c1',
  cliente: 'KALLPA',
  proyecto: 'CSF_SUNNY',
  tipo: 'DRT',
  tecnico: 'Marco Ipusari',
  ejecutado: true,
  consumos: [],
  ...p,
});

const servicios: ServicioRegistro[] = [
  s({ id: '1', fecha: '2026-08-05', consumos: [{ producto: 'Brodifacoum', cantidad: 0.5, unidad: 'kg' }] }),
  s({ id: '2', fecha: '2026-08-20', ejecutado: false }),
  s({ id: '3', fecha: '2026-09-04', tipo: 'LRA', tecnico: 'Jorge Huamán', consumos: [{ producto: 'Hipoclorito', cantidad: 6, unidad: 'L' }] }),
  s({ id: '4', fecha: '2026-09-18', consumos: [{ producto: 'Brodifacoum', cantidad: 0.7, unidad: 'kg' }] }),
  s({ id: '5', fecha: '2026-05-10', clienteId: 'c6', cliente: 'AGROSUR', proyecto: 'ALMACEN_02', tipo: 'DSF', tecnico: 'Luis Beltrán' }),
];

describe('mesesHasta', () => {
  it('devuelve los últimos N meses terminando en el mes de hoy', () => {
    expect(mesesHasta('2026-09-23', 3)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(mesesHasta('2026-02-10', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('ejecutados vs. programados (§10.1)', () => {
  it('cuenta por mes lo programado y lo ejecutado', () => {
    expect(ejecutadosVsProgramados(servicios, ['2026-08', '2026-09'], {})).toEqual([
      { mes: '2026-08', programados: 2, ejecutados: 1 },
      { mes: '2026-09', programados: 2, ejecutados: 2 },
    ]);
  });

  it('filtra por técnico, cliente y tipo de servicio', () => {
    expect(ejecutadosVsProgramados(servicios, ['2026-09'], { tecnico: 'Jorge Huamán' })).toEqual([{ mes: '2026-09', programados: 1, ejecutados: 1 }]);
    expect(ejecutadosVsProgramados(servicios, ['2026-09'], { tipo: 'DRT' })).toEqual([{ mes: '2026-09', programados: 1, ejecutados: 1 }]);
    expect(ejecutadosVsProgramados(servicios, ['2026-09'], { clienteId: 'c6' })).toEqual([{ mes: '2026-09', programados: 0, ejecutados: 0 }]);
  });
});

describe('servicios por tipo y por técnico (§10.1)', () => {
  it('cuenta solo servicios ejecutados del período, de mayor a menor', () => {
    expect(serviciosPorTipo(servicios, ['2026-08', '2026-09'])).toEqual([
      { etiqueta: 'DRT', valor: 2 },
      { etiqueta: 'LRA', valor: 1 },
    ]);
    expect(serviciosPorTecnico(servicios, ['2026-08', '2026-09'])).toEqual([
      { etiqueta: 'Marco Ipusari', valor: 2 },
      { etiqueta: 'Jorge Huamán', valor: 1 },
    ]);
  });
});

describe('vencimientos de certificados (§10.1)', () => {
  const venc = [
    { cliente: 'PETROPERU', fecha: '2026-09-12', tipo: 'LRA' as const },
    { cliente: 'SAMAY', fecha: '2026-09-30', tipo: 'DSF' as const },
    { cliente: 'KALLPA', fecha: '2026-11-10', tipo: 'DRT' as const },
    { cliente: 'CLINIVIDA', fecha: '2026-12-15', tipo: 'DSF' as const },
    { cliente: 'LEJANO', fecha: '2027-06-01', tipo: 'DSF' as const },
  ];

  it('agrupa en vencidos, 30, 60 y 90 días', () => {
    const r = vencimientosCertificados(venc, '2026-09-23', null);
    expect(r.vencidos.map((v) => v.cliente)).toEqual(['PETROPERU']);
    expect(r.en30.map((v) => v.cliente)).toEqual(['SAMAY']);
    expect(r.en60.map((v) => v.cliente)).toEqual(['KALLPA']);
    expect(r.en90.map((v) => v.cliente)).toEqual(['CLINIVIDA']);
    expect(r.vencidos[0].dias).toBe(-11);
  });

  it('filtra por tipo de servicio', () => {
    const r = vencimientosCertificados(venc, '2026-09-23', 'DSF');
    expect([...r.vencidos, ...r.en30, ...r.en60, ...r.en90].map((v) => v.cliente)).toEqual(['SAMAY', 'CLINIVIDA']);
  });
});

describe('consumo mensual de insumos (§10.1)', () => {
  it('suma un producto por mes, separado por tipo de servicio', () => {
    expect(consumoMensual(servicios, ['2026-08', '2026-09'], 'Brodifacoum', null)).toEqual([
      { mes: '2026-08', porTipo: { DRT: 0.5 } },
      { mes: '2026-09', porTipo: { DRT: 0.7 } },
    ]);
  });
});

describe('estaciones con aura ROJO (§10.1)', () => {
  const lista: EstacionCritica[] = [
    { cliente: 'KALLPA', proyecto: 'CSF_SUNNY', plano: 'Planta baja', estacion: 12, visitasConsecutivas: 4 },
    { cliente: 'SAMAY', proyecto: 'ALMACEN_02', plano: 'Planta baja', estacion: 7, visitasConsecutivas: 5 },
  ];
  it('filtra por cliente y proyecto y ordena por visitas consecutivas', () => {
    expect(estacionesCriticas(lista, {}).map((e) => e.estacion)).toEqual([7, 12]);
    expect(estacionesCriticas(lista, { cliente: 'KALLPA' }).map((e) => e.estacion)).toEqual([12]);
  });
});

describe('clientes sin servicio en 90+ días (§10.1, §11)', () => {
  const clientes = [
    { id: 'c1', codigoCorto: 'KALLPA', estado: 'ACTIVO' as const },
    { id: 'c6', codigoCorto: 'AGROSUR', estado: 'ACTIVO' as const },
    { id: 'c12', codigoCorto: 'PLASTIQ', estado: 'INACTIVO' as const },
  ];
  it('lista solo clientes activos cuyo último servicio ejecutado supera los 90 días', () => {
    expect(clientesSinServicio(servicios, clientes, '2026-09-23', null)).toEqual([
      { cliente: 'AGROSUR', ultimoServicio: '2026-05-10', dias: 136 },
    ]);
  });
  it('filtra por tipo de servicio contratado', () => {
    expect(clientesSinServicio(servicios, clientes, '2026-09-23', 'DRT')).toEqual([]);
  });
});

describe('resumen de clientes (§11)', () => {
  it('muestra último servicio, próximo vencimiento y consumo de los últimos 30 días', () => {
    const [kallpa] = resumenClientes(servicios, [{ id: 'c1', codigoCorto: 'KALLPA', razonSocial: 'Kallpa', estado: 'ACTIVO', proximoVencimiento: '2026-10-14' }], '2026-09-23');
    expect(kallpa).toEqual({
      cliente: 'KALLPA',
      razonSocial: 'Kallpa',
      ultimoServicio: '2026-09-18',
      proximoVencimiento: '2026-10-14',
      consumoReciente: ['Hipoclorito: 6 L', 'Brodifacoum: 0.7 kg'],
    });
  });
});

describe('control de actividades (§11)', () => {
  it('filtra servicios realizados por técnico, cliente, proyecto, tipo y fecha, del más reciente al más antiguo', () => {
    expect(filtrarActividades(servicios, {}).map((x) => x.id)).toEqual(['4', '3', '1', '5']);
    expect(filtrarActividades(servicios, { tecnico: 'Jorge Huamán' }).map((x) => x.id)).toEqual(['3']);
    expect(filtrarActividades(servicios, { desde: '2026-09-01', hasta: '2026-09-10' }).map((x) => x.id)).toEqual(['3']);
    expect(filtrarActividades(servicios, { proyecto: 'ALMACEN_02' }).map((x) => x.id)).toEqual(['5']);
  });
});

describe('alertas activas (§11)', () => {
  it('reúne certificados por vencer, estaciones en ROJO, documentos pendientes de más de 48 h y clientes sin servicio', () => {
    const alertas = alertasActivas({
      hoy: '2026-09-23',
      vencimientos: [
        { cliente: 'PETROPERU', fecha: '2026-09-12', tipo: 'LRA' },
        { cliente: 'SAMAY', fecha: '2026-10-05', tipo: 'DSF' },
        { cliente: 'KALLPA', fecha: '2026-12-20', tipo: 'DRT' },
      ],
      estaciones: [{ cliente: 'KALLPA', proyecto: 'CSF_SUNNY', plano: 'Planta baja', estacion: 12, visitasConsecutivas: 4 }],
      pendientes: [
        { id: 'd1', codigo: 'INFORME-KALLPA-014-2026', cliente: 'KALLPA', proyecto: 'PLANTA', fecha: '2026-09-15' },
        { id: 'd9', codigo: 'INFORME-X-001-2026', cliente: 'X', proyecto: 'Y', fecha: '2026-09-23' },
      ],
      sinServicio: [{ cliente: 'AGROSUR', ultimoServicio: '2026-05-10', dias: 136 }],
    });
    expect(alertas.map((a) => a.severidad)).toEqual(['rojo', 'rojo', 'amarillo', 'amarillo', 'ink']);
    expect(alertas.map((a) => a.categoria)).toEqual(['vencido', 'estacion', 'por-vencer', 'pendiente', 'sin-servicio']);
    expect(alertas.map((a) => a.texto)).toEqual([
      'Certificado vencido hace 11 días',
      'Estación 12 en aura ROJO',
      'Certificado vence en 12 días',
      'Documento pendiente de aprobación hace 192 h',
      'Cliente sin servicio hace 136 días',
    ]);
    expect(alertas[3].documentoId).toBe('d1');
  });
});

describe('agruparAlertas', () => {
  it('resume en cinco categorías fijas, en orden de gravedad, aunque alguna esté vacía', () => {
    const grupos = agruparAlertas([
      { id: 'a', categoria: 'estacion', severidad: 'rojo', texto: 'x', detalle: '' },
      { id: 'b', categoria: 'estacion', severidad: 'rojo', texto: 'y', detalle: '' },
      { id: 'c', categoria: 'sin-servicio', severidad: 'ink', texto: 'z', detalle: '' },
    ]);
    expect(grupos.map((g) => [g.categoria, g.alertas.length])).toEqual([
      ['vencido', 0],
      ['estacion', 2],
      ['por-vencer', 0],
      ['pendiente', 0],
      ['sin-servicio', 1],
    ]);
    expect(grupos[1]).toMatchObject({ titulo: 'Estaciones en aura ROJO', severidad: 'rojo' });
  });
});
