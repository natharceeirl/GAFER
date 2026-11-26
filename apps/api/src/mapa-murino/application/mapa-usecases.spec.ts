import { NotFoundException } from '@nestjs/common';
import type { EstacionVisitaEntrada } from '@gafer/contracts';
import { ConflictoMapaError, LimiteMapaExcedidoError, ReglaMapaError } from '../domain/registro-visita';
import { MapaRepositoryMemory } from '../infrastructure/mapa.repository.memory';
import { CrearPlanoUseCase } from './crear-plano.usecase';
import { ListarPlanosUseCase } from './listar-planos.usecase';
import { ObtenerMapaVisitaUseCase } from './obtener-mapa-visita.usecase';
import { RegistrarVisitaMapaUseCase } from './registrar-visita-mapa.usecase';

const PROYECTO = 'p1';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const inspeccion = (huboConsumo: boolean) => ({ tipoCebo: 'Bloque', cantidadGramos: 20, lote: 'L-1', vencimiento: '2027-01-01', huboConsumo });
const nueva = (estacionId: string, numero: number, extra: Partial<EstacionVisitaEntrada> = {}): EstacionVisitaEntrada => ({
  estacionId,
  numero,
  tipoEstacion: 'CEBO_RATICIDA',
  posicion: { x: 10 * numero, y: 10 },
  instalada: true,
  reubicada: false,
  inspeccion: null,
  ...extra,
});
const insp = (estacionId: string, numero: number, consumo: boolean, extra: Partial<EstacionVisitaEntrada> = {}) =>
  nueva(estacionId, numero, { instalada: false, inspeccion: inspeccion(consumo), ...extra });

function armar() {
  const repo = new MapaRepositoryMemory();
  repo.sembrarProyecto(PROYECTO);
  const visita = (n: number, hora = '08:00', proyectoId = PROYECTO) => {
    const id = `v${n}`;
    repo.sembrarVisita({ id, proyectoId, fecha: `2026-02-${String(n).padStart(2, '0')}`, hora, estadoCampo: 'EN_CURSO' });
    return id;
  };
  return {
    repo,
    visita,
    crearPlano: new CrearPlanoUseCase(repo),
    listarPlanos: new ListarPlanosUseCase(repo),
    registrar: new RegistrarVisitaMapaUseCase(repo),
    obtener: new ObtenerMapaVisitaUseCase(repo),
  };
}

describe('CrearPlanoUseCase', () => {
  it('crea un plano en un proyecto existente y lo lista', async () => {
    const { crearPlano, listarPlanos } = armar();
    const plano = await crearPlano.ejecutar(PROYECTO, { nombre: 'Planta baja', puntos: [], cerrado: false });
    expect(plano).toMatchObject({ proyectoId: PROYECTO, nombre: 'Planta baja' });
    expect(await listarPlanos.ejecutar(PROYECTO)).toEqual([plano]);
  });

  it('un proyecto inexistente no tiene planos', async () => {
    const { crearPlano, listarPlanos } = armar();
    await expect(crearPlano.ejecutar('nope', { nombre: 'X', puntos: [], cerrado: false })).rejects.toBeInstanceOf(NotFoundException);
    await expect(listarPlanos.ejecutar('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admite 20 planos por proyecto y rechaza el 21 con un mensaje claro', async () => {
    const { crearPlano } = armar();
    for (let i = 1; i <= 20; i += 1) await crearPlano.ejecutar(PROYECTO, { nombre: `Plano ${i}`, puntos: [], cerrado: false });
    const error = await crearPlano.ejecutar(PROYECTO, { nombre: 'Plano 21', puntos: [], cerrado: false }).catch((e) => e);
    expect(error).toBeInstanceOf(LimiteMapaExcedidoError);
    expect(error.message).toBe('Un proyecto admite hasta 20 planos');
  });

  it('no repite el nombre de un plano dentro del proyecto', async () => {
    const { crearPlano } = armar();
    await crearPlano.ejecutar(PROYECTO, { nombre: 'Patio', puntos: [], cerrado: false });
    await expect(crearPlano.ejecutar(PROYECTO, { nombre: 'Patio', puntos: [], cerrado: false })).rejects.toBeInstanceOf(ConflictoMapaError);
  });
});

describe('RegistrarVisitaMapaUseCase y ObtenerMapaVisitaUseCase', () => {
  async function conPlano() {
    const ctx = armar();
    const plano = await ctx.crearPlano.ejecutar(PROYECTO, { nombre: 'Planta', puntos: [], cerrado: true });
    return { ...ctx, plano };
  }

  it('la visita de instalación deja el ícono VERDE y sin aura, y la siguiente empieza a evaluar', async () => {
    const { registrar, obtener, visita, plano } = await conPlano();
    const v1 = visita(1);
    const v2 = visita(2);
    await registrar.ejecutar(plano.id, v1, { estaciones: [nueva(A, 1)] });
    await registrar.ejecutar(plano.id, v2, { estaciones: [insp(A, 1, true)] });
    const mapa1 = await obtener.ejecutar(plano.id, v1);
    const mapa2 = await obtener.ejecutar(plano.id, v2);
    expect(mapa1.estaciones[0].estacion).toMatchObject({ colorIcono: 'VERDE', colorAura: 'SIN_COLOR' });
    expect(mapa2.estaciones[0].estacion).toMatchObject({ colorIcono: 'ROJO', colorAura: 'VERDE' });
    expect(mapa2.irradiacion).toHaveLength(1);
    expect(mapa2.resumen).toMatchObject({ estaciones: 1, hasta: '2026-02-02' });
  });

  it('el mapa de una visita pasada se reconstruye igual que se vio ese día, aunque haya visitas posteriores', async () => {
    const { registrar, obtener, visita, plano } = await conPlano();
    const ids = [visita(1), visita(2), visita(3), visita(4)];
    await registrar.ejecutar(plano.id, ids[0], { estaciones: [nueva(A, 1)] });
    const visto = await obtener.ejecutar(plano.id, ids[0]);
    await registrar.ejecutar(plano.id, ids[1], { estaciones: [insp(A, 1, true), nueva(B, 2)] });
    const visto2 = await obtener.ejecutar(plano.id, ids[1]);
    await registrar.ejecutar(plano.id, ids[2], { estaciones: [insp(A, 1, true, { reubicada: true, posicion: { x: 500, y: 500 } }), insp(B, 2, true)] });
    await registrar.ejecutar(plano.id, ids[3], { estaciones: [insp(A, 1, false, { posicion: { x: 500, y: 500 } })] });
    expect(await obtener.ejecutar(plano.id, ids[0])).toEqual(visto);
    expect(await obtener.ejecutar(plano.id, ids[1])).toEqual(visto2);
  });

  it('una estación reubicada conserva su aura y el mapa muestra de dónde se movió', async () => {
    const { registrar, obtener, visita, plano } = await conPlano();
    const ids = [visita(1), visita(2), visita(3)];
    await registrar.ejecutar(plano.id, ids[0], { estaciones: [nueva(A, 1)] });
    await registrar.ejecutar(plano.id, ids[1], { estaciones: [insp(A, 1, true)] });
    await registrar.ejecutar(plano.id, ids[2], { estaciones: [insp(A, 1, true, { reubicada: true, posicion: { x: 77, y: 88 } })] });
    const [e] = (await obtener.ejecutar(plano.id, ids[2])).estaciones;
    expect(e.estacion.colorAura).toBe('AMARILLO');
    expect(e.posicion).toEqual({ x: 77, y: 88 });
    expect(e.reubicadaDesde).toEqual({ x: 10, y: 10 });
    expect(e.reubicaciones).toEqual(['2026-02-03']);
    expect((await obtener.ejecutar(plano.id, ids[1])).estaciones[0].reubicadaDesde).toBeNull();
  });

  it('una estación nueva empieza a evaluarse la visita siguiente', async () => {
    const { registrar, obtener, visita, plano } = await conPlano();
    const ids = [visita(1), visita(2), visita(3)];
    await registrar.ejecutar(plano.id, ids[0], { estaciones: [nueva(A, 1)] });
    await registrar.ejecutar(plano.id, ids[1], { estaciones: [insp(A, 1, true), nueva(B, 2)] });
    await registrar.ejecutar(plano.id, ids[2], { estaciones: [insp(A, 1, true), insp(B, 2, true)] });
    const enV2 = (await obtener.ejecutar(plano.id, ids[1])).estaciones.find((e) => e.estacion.id === B)!;
    const enV3 = (await obtener.ejecutar(plano.id, ids[2])).estaciones.find((e) => e.estacion.id === B)!;
    expect(enV2.estacion.colorAura).toBe('SIN_COLOR');
    expect(enV3.estacion.colorAura).toBe('VERDE');
  });

  it('puede volver a registrar la misma visita mientras es la última', async () => {
    const { registrar, obtener, visita, plano } = await conPlano();
    const v1 = visita(1);
    await registrar.ejecutar(plano.id, v1, { estaciones: [nueva(A, 1)] });
    await registrar.ejecutar(plano.id, v1, { estaciones: [nueva(A, 1), nueva(B, 2)] });
    expect((await obtener.ejecutar(plano.id, v1)).estaciones).toHaveLength(2);
  });

  it('no reescribe el pasado: una visita anterior a otra ya registrada responde conflicto', async () => {
    const { registrar, visita, plano } = await conPlano();
    const v1 = visita(1);
    const v2 = visita(2);
    await registrar.ejecutar(plano.id, v1, { estaciones: [nueva(A, 1)] });
    await registrar.ejecutar(plano.id, v2, { estaciones: [insp(A, 1, true)] });
    await expect(registrar.ejecutar(plano.id, v1, { estaciones: [nueva(A, 1)] })).rejects.toBeInstanceOf(ConflictoMapaError);
  });

  it('ordena por hora cuando dos visitas son del mismo día', async () => {
    const { registrar, repo, plano } = await conPlano();
    repo.sembrarVisita({ id: 'tarde', proyectoId: PROYECTO, fecha: '2026-03-01', hora: '15:00', estadoCampo: 'EN_CURSO' });
    repo.sembrarVisita({ id: 'manana', proyectoId: PROYECTO, fecha: '2026-03-01', hora: '08:00', estadoCampo: 'EN_CURSO' });
    await registrar.ejecutar(plano.id, 'manana', { estaciones: [nueva(A, 1)] });
    await registrar.ejecutar(plano.id, 'tarde', { estaciones: [insp(A, 1, true)] });
    await expect(registrar.ejecutar(plano.id, 'manana', { estaciones: [nueva(A, 1)] })).rejects.toBeInstanceOf(ConflictoMapaError);
  });

  it('una visita en revisión ya no admite cambios', async () => {
    const { registrar, repo, visita, plano } = await conPlano();
    const v1 = visita(1);
    await registrar.ejecutar(plano.id, v1, { estaciones: [nueva(A, 1)] });
    repo.cambiarEstadoVisita(v1, 'EN_REVISION');
    await expect(registrar.ejecutar(plano.id, v1, { estaciones: [nueva(A, 1), nueva(B, 2)] })).rejects.toBeInstanceOf(ConflictoMapaError);
  });

  it('rechaza visitas o planos inexistentes y visitas de otro proyecto', async () => {
    const { registrar, obtener, visita, repo, plano } = await conPlano();
    repo.sembrarProyecto('otro');
    const ajena = visita(9, '08:00', 'otro');
    await expect(registrar.ejecutar('no-plano', visita(1), { estaciones: [nueva(A, 1)] })).rejects.toBeInstanceOf(NotFoundException);
    await expect(registrar.ejecutar(plano.id, 'no-visita', { estaciones: [nueva(A, 1)] })).rejects.toBeInstanceOf(NotFoundException);
    await expect(registrar.ejecutar(plano.id, ajena, { estaciones: [nueva(A, 1)] })).rejects.toBeInstanceOf(ReglaMapaError);
    await expect(obtener.ejecutar(plano.id, 'v1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('las reglas del dominio rechazan datos inválidos y no guardan nada', async () => {
    const { registrar, obtener, visita, plano } = await conPlano();
    const v1 = visita(1);
    await expect(registrar.ejecutar(plano.id, v1, { estaciones: [insp(A, 1, true)] })).rejects.toBeInstanceOf(ReglaMapaError);
    await expect(obtener.ejecutar(plano.id, v1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admite 100 estaciones por plano y rechaza la 101', async () => {
    const { registrar, visita, plano } = await conPlano();
    const id = (i: number) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`;
    const cien = Array.from({ length: 100 }, (_, i) => nueva(id(i), i + 1));
    await registrar.ejecutar(plano.id, visita(1), { estaciones: cien });
    const ciento1 = [...cien, nueva(id(100), 1)];
    await expect(registrar.ejecutar(plano.id, visita(2), { estaciones: ciento1 })).rejects.toBeInstanceOf(LimiteMapaExcedidoError);
  });

  it('el número de una estación retirada no se reutiliza en el plano', async () => {
    const { registrar, visita, plano } = await conPlano();
    await registrar.ejecutar(plano.id, visita(1), { estaciones: [nueva(A, 1), nueva(B, 2)] });
    await registrar.ejecutar(plano.id, visita(2), { estaciones: [insp(A, 1, false)] });
    await expect(
      registrar.ejecutar(plano.id, visita(3), { estaciones: [insp(A, 1, false), nueva('33333333-3333-4333-8333-333333333333', 2)] }),
    ).rejects.toBeInstanceOf(ConflictoMapaError);
  });
});
