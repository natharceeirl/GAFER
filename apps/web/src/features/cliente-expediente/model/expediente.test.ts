import { describe, expect, it } from 'vitest';
import { alertaVencimiento, carpetaDelCliente, correlativos, historialPorProyecto } from './expediente';
import type { ServicioRegistro } from '../../estadisticas/model/estadisticas';

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

const historial: ServicioRegistro[] = [
  s({ id: '1', fecha: '2025-12-10' }),
  s({ id: '2', fecha: '2026-01-15', tipo: 'LRA' }),
  s({ id: '3', fecha: '2026-02-01', ejecutado: false }),
  s({ id: '4', fecha: '2026-02-20', proyecto: 'ALMACEN_02', tipo: 'DSF' }),
  s({ id: '5', fecha: '2026-03-05' }),
  s({ id: '6', fecha: '2026-03-06', clienteId: 'c2', cliente: 'SAMAY' }),
];

describe('carpeta y numeración (§2, §3)', () => {
  it('genera un PDF por servicio ejecutado, con correlativo continuo por cliente y por tipo de documento', () => {
    const carpeta = carpetaDelCliente(historial, 'c1', 'KALLPA');
    expect(carpeta.map((d) => d.nombre)).toEqual([
      'REPORTE-KALLPA-002-2026.pdf',
      'INFORME-KALLPA-002-2026.pdf',
      'INFORME-KALLPA-001-2026.pdf',
      'REPORTE-KALLPA-001-2025.pdf',
    ]);
  });

  it('ordena la carpeta como CLIENTE / PROYECTO / SERVICIO / AÑO', () => {
    const [ultimo] = carpetaDelCliente(historial, 'c1', 'KALLPA');
    expect(ultimo.ruta).toBe('KALLPA / CSF_SUNNY / DRT / 2026');
  });

  it('informa el último correlativo de cada tipo de documento', () => {
    expect(correlativos(carpetaDelCliente(historial, 'c1', 'KALLPA'))).toEqual({
      INFORME: 'INFORME-KALLPA-002-2026',
      REPORTE: 'REPORTE-KALLPA-002-2026',
    });
    expect(correlativos([])).toEqual({ INFORME: null, REPORTE: null });
  });
});

describe('historialPorProyecto (§3)', () => {
  it('agrupa los servicios ejecutados por proyecto, del más reciente al más antiguo', () => {
    const grupos = historialPorProyecto(historial, 'c1');
    expect(grupos.map((g) => [g.proyecto, g.servicios.map((x) => x.id)])).toEqual([
      ['ALMACEN_02', ['4']],
      ['CSF_SUNNY', ['5', '2', '1']],
    ]);
  });
});

describe('alertaVencimiento (§3, anticipación configurable)', () => {
  it('avisa solo dentro de la anticipación elegida', () => {
    expect(alertaVencimiento('2026-10-14', '2026-09-23', 30)).toEqual({ dias: 21, vencido: false });
    expect(alertaVencimiento('2026-10-14', '2026-09-23', 15)).toBeNull();
    expect(alertaVencimiento('2026-09-12', '2026-09-23', 15)).toEqual({ dias: -11, vencido: true });
    expect(alertaVencimiento(null, '2026-09-23', 30)).toBeNull();
  });
});
