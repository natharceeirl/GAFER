/**
 * mapa-murino.e2e-spec.ts
 * Mapa Murino por proyecto contra la aplicación real y PostgreSQL: planos, estaciones por visita,
 * límites de 20 planos y 100 estaciones, y reconstrucción exacta de visitas pasadas (GAF-62).
 */
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { createTestApp, TestApp } from '../support/app';
import { autorizacion } from '../support/auth';
import { resetDb } from '../support/db';
import { api, Api, crearEscenario } from '../support/fixtures';

const inspeccion = (huboConsumo: boolean) => ({
  tipoCebo: 'Bloque',
  cantidadGramos: 20,
  lote: 'L-1',
  vencimiento: '2027-01-01',
  huboConsumo,
  ...(huboConsumo ? { porcentajeConsumo: 50 } : { estadoFisico: 'BUENAS_CONDICIONES' }),
});

const instalar = (estacionId: string, numero: number, extra: object = {}) => ({
  estacionId,
  numero,
  tipoEstacion: 'CEBO_RATICIDA',
  posicion: { x: 10 * numero, y: 10 },
  instalada: true,
  reubicada: false,
  inspeccion: null,
  ...extra,
});
const inspeccionar = (estacionId: string, numero: number, huboConsumo: boolean, extra: object = {}) =>
  instalar(estacionId, numero, { instalada: false, inspeccion: inspeccion(huboConsumo), ...extra });

describe('Mapa Murino por proyecto (GAF-62)', () => {
  let t: TestApp;
  let http: Api;
  let clienteId: string;
  let proyectoId: string;
  let servicioId: string;
  const A = randomUUID();
  const B = randomUUID();

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
  });

  beforeEach(async () => {
    await resetDb(t.db);
    const esc = await crearEscenario(http);
    clienteId = esc.clienteId;
    proyectoId = esc.proyectoId;
    servicioId = esc.servicioId;
  });

  afterAll(async () => {
    await t.close();
  });

  async function crearVisita(fecha: string, hora = '08:00', proyecto = proyectoId): Promise<string> {
    const res = await t.db.query(
      `INSERT INTO visitas (cliente_id, proyecto_id, servicio_id, fecha, hora) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [clienteId, proyecto, servicioId, fecha, hora],
    );
    return res.rows[0].id as string;
  }

  async function crearPlano(nombre = 'Planta baja', proyecto = proyectoId) {
    return http.post(`/mapa-murino/proyectos/${proyecto}/planos`, { nombre, puntos: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }], cerrado: true });
  }

  const registrar = (planoId: string, visitaId: string, estaciones: object[], cargo: 'ADMINISTRADOR' | 'SUPERVISOR' | 'TECNICO_OPERADOR' = 'TECNICO_OPERADOR') =>
    http.put(`/mapa-murino/planos/${planoId}/visitas/${visitaId}`, { estaciones }, autorizacion(cargo));

  const verMapa = (planoId: string, visitaId: string) => http.get(`/mapa-murino/planos/${planoId}/visitas/${visitaId}`, autorizacion('TECNICO_OPERADOR'));

  describe('planos', () => {
    it('crea y lista los planos de un proyecto', async () => {
      const creado = await crearPlano('Patio');
      expect(creado.status).toBe(201);
      expect(creado.body).toMatchObject({ proyectoId, nombre: 'Patio', cerrado: true });
      expect(creado.body.puntos).toHaveLength(3);

      const lista = await http.get(`/mapa-murino/proyectos/${proyectoId}/planos`, autorizacion('TECNICO_OPERADOR'));
      expect(lista.status).toBe(200);
      expect(lista.body).toEqual([creado.body]);
    });

    it('responde 404 si el proyecto no existe, 400 con datos inválidos y 409 con nombre repetido', async () => {
      expect((await crearPlano('X', randomUUID())).status).toBe(404);
      const sinNombre = await http.post(`/mapa-murino/proyectos/${proyectoId}/planos`, { nombre: ' ' });
      expect(sinNombre.status).toBe(400);
      expect(sinNombre.body.message.join()).toContain('nombre');
      await crearPlano('Repetido');
      const repetido = await crearPlano('Repetido');
      expect(repetido.status).toBe(409);
      expect(repetido.body.message).toContain('nombre');
    });

    it('admite 20 planos por proyecto y el 21 responde 409 con un mensaje claro', async () => {
      for (let i = 1; i <= 20; i += 1) expect((await crearPlano(`Plano ${i}`)).status).toBe(201);
      const veintiuno = await crearPlano('Plano 21');
      expect(veintiuno.status).toBe(409);
      expect(veintiuno.body.message).toBe('Un proyecto admite hasta 20 planos');
    });

    it('el límite de 20 lo sostiene la base aunque las altas lleguen a la vez', async () => {
      const respuestas = await Promise.all(Array.from({ length: 26 }, (_, i) => crearPlano(`Simultaneo ${i}`)));
      const estados = respuestas.map((r) => r.status);
      expect(estados.filter((s) => s === 201)).toHaveLength(20);
      expect(estados.filter((s) => s === 409)).toHaveLength(6);
      const cuenta = await t.db.query('SELECT count(*)::int AS n FROM planos WHERE proyecto_id = $1', [proyectoId]);
      expect(cuenta.rows[0].n).toBe(20);
    });

    it('el límite es por proyecto: otro proyecto tiene sus propios 20', async () => {
      for (let i = 1; i <= 20; i += 1) await crearPlano(`Plano ${i}`);
      const otro = await crearEscenario(http);
      expect((await crearPlano('Plano 1', otro.proyectoId)).status).toBe(201);
    });
  });

  describe('roles', () => {
    it('el Técnico lee planos y mapas y registra lo visto, pero no crea planos', async () => {
      const plano = (await crearPlano()).body;
      const visitaId = await crearVisita('2026-03-01');
      const denegado = await http.post(`/mapa-murino/proyectos/${proyectoId}/planos`, { nombre: 'Otro' }, autorizacion('TECNICO_OPERADOR'));
      expect(denegado.status).toBe(403);
      expect((await registrar(plano.id, visitaId, [instalar(A, 1)], 'TECNICO_OPERADOR')).status).toBe(200);
      expect((await verMapa(plano.id, visitaId)).status).toBe(200);
      expect((await http.get(`/mapa-murino/planos/${plano.id}/visitas`, autorizacion('TECNICO_OPERADOR'))).status).toBe(200);
    });

    it('el Supervisor crea planos y las peticiones sin sesión responden 401', async () => {
      const creado = await http.post(`/mapa-murino/proyectos/${proyectoId}/planos`, { nombre: 'Del supervisor' }, autorizacion('SUPERVISOR'));
      expect(creado.status).toBe(201);
      const sinToken = await api(t.baseUrl, null).get(`/mapa-murino/proyectos/${proyectoId}/planos`);
      expect(sinToken.status).toBe(401);
    });
  });

  describe('estaciones por visita', () => {
    it('instala sin evaluar y desde la visita siguiente calcula ícono y aura', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const v2 = await crearVisita('2026-03-15');
      const primera = await registrar(plano.id, v1, [instalar(A, 1)]);
      expect(primera.status).toBe(200);
      expect(primera.body.estaciones[0]).toMatchObject({ estacion: { id: A, colorIcono: 'VERDE', colorAura: 'SIN_COLOR' }, instaladaEnVisita: true });

      const segunda = await registrar(plano.id, v2, [inspeccionar(A, 1, true)]);
      expect(segunda.body.estaciones[0].estacion).toMatchObject({ colorIcono: 'ROJO', colorAura: 'VERDE' });
      expect(segunda.body.estaciones[0].historial).toEqual([{ ...inspeccion(true), fecha: '2026-03-15' }]);
      expect(segunda.body.resumen).toMatchObject({ estaciones: 1, circulos: 1, desde: '2026-03-01', hasta: '2026-03-15' });
      expect(segunda.body.irradiacion).toEqual([
        { estacionId: A, posicion: { x: 10, y: 10 }, colorAura: 'VERDE', radio: 100, intensidad: 0.16 },
      ]);
    });

    it('el mapa de cualquier visita pasada se reconstruye exactamente como se vio ese día', async () => {
      const plano = (await crearPlano()).body;
      const visitas = [await crearVisita('2026-03-01'), await crearVisita('2026-03-10'), await crearVisita('2026-03-20'), await crearVisita('2026-03-30')];
      const vistos: unknown[] = [];

      vistos.push((await registrar(plano.id, visitas[0], [instalar(A, 1)])).body);
      vistos.push((await registrar(plano.id, visitas[1], [inspeccionar(A, 1, true), instalar(B, 2, { tipoEstacion: 'TRAMPA_MECANICA' })])).body);
      vistos.push((await registrar(plano.id, visitas[2], [inspeccionar(A, 1, true, { reubicada: true, posicion: { x: 300, y: 200 } }), inspeccionar(B, 2, true, { tipoEstacion: 'TRAMPA_MECANICA' })])).body);
      vistos.push((await registrar(plano.id, visitas[3], [inspeccionar(A, 1, false, { posicion: { x: 300, y: 200 } })])).body);

      for (let i = 0; i < visitas.length; i += 1) {
        const reconstruido = await verMapa(plano.id, visitas[i]);
        expect(reconstruido.status).toBe(200);
        expect(reconstruido.body).toEqual(vistos[i]);
      }
      // La visita 3 sigue mostrando la estación B que la 4 ya retiró.
      expect((vistos[2] as { estaciones: unknown[] }).estaciones).toHaveLength(2);
      expect((vistos[3] as { estaciones: unknown[] }).estaciones).toHaveLength(1);
    });

    it('una estación reubicada conserva su aura y el mapa muestra de dónde se movió', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const v2 = await crearVisita('2026-03-10');
      const v3 = await crearVisita('2026-03-20');
      await registrar(plano.id, v1, [instalar(A, 1)]);
      await registrar(plano.id, v2, [inspeccionar(A, 1, true)]);
      const tercera = await registrar(plano.id, v3, [inspeccionar(A, 1, true, { reubicada: true, posicion: { x: 250, y: 150 } })]);
      expect(tercera.body.estaciones[0]).toMatchObject({
        estacion: { colorAura: 'AMARILLO' },
        posicion: { x: 250, y: 150 },
        reubicadaDesde: { x: 10, y: 10 },
        reubicaciones: ['2026-03-20'],
      });
      expect((await verMapa(plano.id, v2)).body.estaciones[0].reubicadaDesde).toBeNull();
    });

    it('una estación nueva empieza a evaluarse la visita siguiente', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const v2 = await crearVisita('2026-03-10');
      const v3 = await crearVisita('2026-03-20');
      await registrar(plano.id, v1, [instalar(A, 1)]);
      const segunda = await registrar(plano.id, v2, [inspeccionar(A, 1, true), instalar(B, 2)]);
      expect(segunda.body.estaciones.find((e: { estacion: { id: string } }) => e.estacion.id === B).estacion.colorAura).toBe('SIN_COLOR');
      const tercera = await registrar(plano.id, v3, [inspeccionar(A, 1, true), inspeccionar(B, 2, true)]);
      expect(tercera.body.estaciones.find((e: { estacion: { id: string } }) => e.estacion.id === B).estacion.colorAura).toBe('VERDE');
    });

    it('lista las visitas con registro y vuelve a registrar la última visita sin duplicar filas', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      await registrar(plano.id, v1, [instalar(A, 1)]);
      await registrar(plano.id, v1, [instalar(A, 1), instalar(B, 2)]);
      const lista = await http.get(`/mapa-murino/planos/${plano.id}/visitas`);
      expect(lista.body).toEqual([{ visitaId: v1, fecha: '2026-03-01', estaciones: 2 }]);
    });

    it('rechaza con 400 las reglas del mapa incumplidas y no guarda nada', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const sinInstalar = await registrar(plano.id, v1, [inspeccionar(A, 1, true)]);
      expect(sinInstalar.status).toBe(400);
      expect(sinInstalar.body.message).toContain('no está instalada');
      const conInspeccion = await registrar(plano.id, v1, [instalar(A, 1, { inspeccion: inspeccion(true) })]);
      expect(conInspeccion.status).toBe(400);
      expect((await verMapa(plano.id, v1)).status).toBe(404);
    });

    it('rechaza con 400 una carga mal formada y más de 100 estaciones', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const malFormada = await registrar(plano.id, v1, [{ estacionId: 'no-uuid', numero: 0 }]);
      expect(malFormada.status).toBe(400);
      const muchas = Array.from({ length: 101 }, (_, i) => instalar(randomUUID(), (i % 100) + 1));
      const respuesta = await registrar(plano.id, v1, muchas);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message.join()).toContain('hasta 100 estaciones');
    });

    it('admite 100 estaciones por plano', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const cien = Array.from({ length: 100 }, (_, i) => instalar(randomUUID(), i + 1));
      const respuesta = await registrar(plano.id, v1, cien);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.estaciones).toHaveLength(100);
      expect(respuesta.body.resumen.estaciones).toBe(100);
    });

    it('responde 404 con plano o visita inexistentes y 409 si la visita es de otro proyecto o ya hay visitas posteriores', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const v2 = await crearVisita('2026-03-10');
      expect((await registrar(randomUUID(), v1, [instalar(A, 1)])).status).toBe(404);
      expect((await registrar(plano.id, randomUUID(), [instalar(A, 1)])).status).toBe(404);

      const otro = await crearEscenario(http);
      const ajena = await crearVisita('2026-03-05', '08:00', otro.proyectoId);
      expect((await registrar(plano.id, ajena, [instalar(A, 1)])).status).toBe(400);

      await registrar(plano.id, v1, [instalar(A, 1)]);
      await registrar(plano.id, v2, [inspeccionar(A, 1, true)]);
      const pasado = await registrar(plano.id, v1, [instalar(A, 1)]);
      expect(pasado.status).toBe(409);
      expect(pasado.body.message).toContain('no se reescribe');
    });

    it('el número de una estación retirada no se reutiliza (409)', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const v2 = await crearVisita('2026-03-10');
      const v3 = await crearVisita('2026-03-20');
      await registrar(plano.id, v1, [instalar(A, 1), instalar(B, 2)]);
      await registrar(plano.id, v2, [inspeccionar(A, 1, false)]);
      const reuso = await registrar(plano.id, v3, [inspeccionar(A, 1, false), instalar(randomUUID(), 2)]);
      expect(reuso.status).toBe(409);
      expect(reuso.body.message).toContain('número');
    });

    it('una visita en revisión ya no admite cambios: el mapa queda como se vio', async () => {
      const plano = (await crearPlano()).body;
      const v1 = await crearVisita('2026-03-01');
      const guardado = (await registrar(plano.id, v1, [instalar(A, 1)])).body;
      await t.db.query(`UPDATE visitas SET estado_campo = 'EN_REVISION' WHERE id = $1`, [v1]);
      const bloqueada = await registrar(plano.id, v1, [instalar(A, 1), instalar(B, 2)]);
      expect(bloqueada.status).toBe(409);
      expect(bloqueada.body.message).toContain('en revisión');
      expect((await verMapa(plano.id, v1)).body).toEqual(guardado);
    });
  });

  describe('restricciones en la base', () => {
    async function sembrarBasico() {
      const plano = (await crearPlano()).body as { id: string };
      const visita = await crearVisita('2026-03-01');
      await registrar(plano.id, visita, [instalar(A, 1)]);
      return { planoId: plano.id, visita };
    }

    it('no admite una estación numerada fuera de 1 a 100 ni repetir el número en el plano', async () => {
      const { planoId } = await sembrarBasico();
      await expect(
        t.db.query(`INSERT INTO mapa_estaciones (id, plano_id, numero, tipo_estacion) VALUES ($1, $2, 101, 'CEBO_RATICIDA')`, [randomUUID(), planoId]),
      ).rejects.toMatchObject({ constraint: 'mapa_estaciones_limite_por_plano' });
      await expect(
        t.db.query(`INSERT INTO mapa_estaciones (id, plano_id, numero, tipo_estacion) VALUES ($1, $2, 1, 'CEBO_RATICIDA')`, [randomUUID(), planoId]),
      ).rejects.toMatchObject({ constraint: 'uq_mapa_estacion_plano_numero' });
    });

    it('la inspección es obligatoria salvo en la visita de instalación', async () => {
      const { planoId, visita } = await sembrarBasico();
      const visita2 = await crearVisita('2026-03-10');
      await expect(
        t.db.query(
          `INSERT INTO mapa_visita_estaciones (visita_id, estacion_id, plano_id, pos_x, pos_y, instalada, inspeccion) VALUES ($1, $2, $3, 1, 1, false, NULL)`,
          [visita2, A, planoId],
        ),
      ).rejects.toMatchObject({ constraint: 'chk_mapa_visita_inspeccion' });
      await expect(
        t.db.query(`UPDATE mapa_visita_estaciones SET inspeccion = '{}'::jsonb WHERE visita_id = $1`, [visita]),
      ).rejects.toMatchObject({ constraint: 'chk_mapa_visita_inspeccion' });
    });

    it('una visita en revisión rechaza insertar, cambiar o borrar filas, aunque se haga directo en la base', async () => {
      const { planoId, visita } = await sembrarBasico();
      await t.db.query(`UPDATE visitas SET estado_campo = 'EN_REVISION' WHERE id = $1`, [visita]);
      await expect(t.db.query(`UPDATE mapa_visita_estaciones SET pos_x = 99 WHERE visita_id = $1`, [visita])).rejects.toMatchObject({ constraint: 'mapa_visita_inmutable' });
      await expect(t.db.query(`DELETE FROM mapa_visita_estaciones WHERE visita_id = $1`, [visita])).rejects.toMatchObject({ constraint: 'mapa_visita_inmutable' });
      const otra = randomUUID();
      await t.db.query(`INSERT INTO mapa_estaciones (id, plano_id, numero, tipo_estacion) VALUES ($1, $2, 2, 'CEBO_RATICIDA')`, [otra, planoId]);
      await expect(
        t.db.query(`INSERT INTO mapa_visita_estaciones (visita_id, estacion_id, plano_id, pos_x, pos_y, instalada) VALUES ($1, $2, $3, 1, 1, true)`, [visita, otra, planoId]),
      ).rejects.toMatchObject({ constraint: 'mapa_visita_inmutable' });
    });

    it('la visita y el plano deben ser del mismo proyecto', async () => {
      const { planoId } = await sembrarBasico();
      const otro = await crearEscenario(http);
      const ajena = await crearVisita('2026-03-05', '08:00', otro.proyectoId);
      await expect(
        t.db.query(`INSERT INTO mapa_visita_estaciones (visita_id, estacion_id, plano_id, pos_x, pos_y, instalada) VALUES ($1, $2, $3, 1, 1, true)`, [ajena, A, planoId]),
      ).rejects.toMatchObject({ constraint: 'mapa_visita_mismo_proyecto' });
    });
  });

  describe('migración 008', () => {
    const dir = path.resolve(__dirname, '../../../../infra/migrations');

    it('se puede reaplicar sin error ni pérdida de datos, y revertir y volver a aplicar', async () => {
      const up = await readFile(path.join(dir, '008_mapa_murino.up.sql'), 'utf-8');
      const down = await readFile(path.join(dir, '008_mapa_murino.down.sql'), 'utf-8');
      const plano = (await crearPlano('Persistente')).body;

      await t.db.query(up);
      await t.db.query(up);
      const intacto = await t.db.query('SELECT count(*)::int AS n FROM planos WHERE id = $1', [plano.id]);
      expect(intacto.rows[0].n).toBe(1);

      await t.db.query(down);
      await t.db.query(down);
      const sinTablas = await t.db.query(`SELECT to_regclass('planos') AS p, to_regclass('mapa_estaciones') AS e, to_regclass('mapa_visita_estaciones') AS v`);
      expect(sinTablas.rows[0]).toEqual({ p: null, e: null, v: null });
      await t.db.query(up);
      const reconstruidas = await t.db.query(`SELECT to_regclass('planos') AS p`);
      expect(reconstruidas.rows[0].p).not.toBeNull();
    });
  });
});
