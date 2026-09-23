import { describe, expect, it } from 'vitest';
import { generarHistorial } from '../../estadisticas/model/historial-mock';
import { CLIENTES_MOCK } from '../../cliente-expediente/model/clientes-mock';
import { estacionesRojoDe, mapaDelProyecto } from './mapas-mock';
import { estadoDelMapa, LIMITES_MAPA } from './visitas-mapa';

const HOY = '2026-09-23';
const historial = generarHistorial(HOY);
const kallpa = CLIENTES_MOCK.find((c) => c.codigoCorto === 'KALLPA')!;
const agrosur = CLIENTES_MOCK.find((c) => c.codigoCorto === 'AGROSUR')!;

describe('mapaDelProyecto: un mapa murino por proyecto, a lo largo de sus visitas', () => {
  const mapa = mapaDelProyecto(historial, kallpa, 'CSF_SUNNY')!;

  it('tiene una visita por cada desratización ejecutada en la sede', () => {
    const ejecutadas = historial.filter((s) => s.clienteId === kallpa.id && s.proyecto === 'CSF_SUNNY' && s.tipo === 'DRT' && s.ejecutado);
    expect(mapa.visitas.map((v) => v.fecha)).toEqual(ejecutadas.map((s) => s.fecha).sort());
  });

  it('la primera visita instala todas las estaciones', () => {
    expect(mapa.visitas[0].eventos.every((e) => e.instalada && e.inspeccion === null)).toBe(true);
  });

  it('respeta los límites de 20 planos y 100 estaciones por plano', () => {
    expect(mapa.planos.length).toBeLessThanOrEqual(LIMITES_MAPA.planosPorProyecto);
    for (const v of mapa.visitas) {
      for (const p of mapa.planos) {
        expect(v.eventos.filter((e) => e.planoId === p.id).length).toBeLessThanOrEqual(LIMITES_MAPA.estacionesPorPlano);
      }
    }
  });

  it('a lo largo de las visitas hay estaciones reubicadas y estaciones agregadas', () => {
    const eventos = mapa.visitas.slice(1).flatMap((v) => v.eventos);
    expect(eventos.some((e) => e.reubicadaDesde !== null)).toBe(true);
    expect(eventos.some((e) => e.instalada)).toBe(true);
  });

  it('ninguna estación queda encima de otra en el mismo plano', () => {
    mapa.visitas.forEach((_, i) => {
      const estado = estadoDelMapa(mapa.visitas, i);
      for (const a of estado) {
        for (const b of estado) {
          if (a === b || a.planoId !== b.planoId) continue;
          expect(Math.hypot(a.posicion.x - b.posicion.x, a.posicion.y - b.posicion.y)).toBeGreaterThanOrEqual(30);
        }
      }
    });
  });

  it('es determinista', () => {
    expect(mapaDelProyecto(historial, kallpa, 'CSF_SUNNY')).toEqual(mapa);
  });

  it('no hay mapa para un proyecto sin desratización', () => {
    expect(mapaDelProyecto(historial, agrosur, 'ALMACEN_02')).toBeNull();
  });
});

describe('estacionesRojoDe', () => {
  it('lista las estaciones con aura ROJO al cierre de la última visita de cada mapa', () => {
    const rojas = estacionesRojoDe(historial, CLIENTES_MOCK);
    const mapa = mapaDelProyecto(historial, kallpa, 'CSF_SUNNY')!;
    const finalKallpa = estadoDelMapa(mapa.visitas, mapa.visitas.length - 1).filter((e) => e.estacion.colorAura === 'ROJO');
    expect(rojas.filter((r) => r.cliente === 'KALLPA').map((r) => r.estacion).sort()).toEqual(finalKallpa.map((e) => e.estacion.numero).sort());
    expect(rojas.every((r) => r.visitasConsecutivas >= 1)).toBe(true);
  });
});
