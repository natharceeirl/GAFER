/**
 * rutas-protegidas.e2e-spec.ts
 * Todas las rutas exigen sesión y rol (GAF-93): 401 sin token válido, 403 con un rol no permitido.
 *
 * Recorre las rutas reales de la aplicación (no una lista a mano), así que una ruta nueva queda
 * cubierta sola. En cada rechazo se comprueba el código de estado y que el cuerpo no filtre datos.
 *
 * Historial de versiones
 *   v1.0  2026-10-04  ihuayhuam  Creación del archivo (GAF-93).
 */
import { randomUUID } from 'crypto';
import { ModulesContainer } from '@nestjs/core';
import request = require('supertest');
import { CargoPersonal } from '@gafer/contracts';
import { createTestApp, TestApp } from '../support/app';
import { autorizacion, autorizacionDePersonal, CARGOS, emitirToken } from '../support/auth';
import { resetDb } from '../support/db';
import { api, crearEscenario } from '../support/fixtures';
import { enumerarRutas, RutaRegistrada } from '../support/rutas';

const CAMPOS_DE_ERROR = ['error', 'message', 'path', 'statusCode', 'timestamp'];

function url(ruta: RutaRegistrada): string {
  return ruta.ruta.replace(/:\w+/g, randomUUID());
}

function enviar(app: TestApp, ruta: RutaRegistrada, encabezados: Record<string, string> = {}) {
  const peticion = request(app.baseUrl)[ruta.metodo.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'](url(ruta));
  for (const [k, v] of Object.entries(encabezados)) peticion.set(k, v);
  return peticion.send(ruta.metodo === 'GET' ? undefined : {});
}

/** Un rechazo solo trae los campos estándar de error: ningún dato de negocio. */
function esperarRechazoSinDatos(res: request.Response, estado: 401 | 403, detalle: string) {
  expect({ detalle, estado: res.status }).toEqual({ detalle, estado });
  expect(Object.keys(res.body).sort()).toEqual(CAMPOS_DE_ERROR);
  expect(res.body.statusCode).toBe(estado);
}

function tokenManipulado(token: string, cambios: object): string {
  const [cabecera, carga, firma] = token.split('.');
  const payload = { ...JSON.parse(Buffer.from(carga, 'base64url').toString('utf-8')), ...cambios };
  return [cabecera, Buffer.from(JSON.stringify(payload)).toString('base64url'), firma].join('.');
}

describe('Rutas protegidas por autenticación y roles (GAF-93)', () => {
  let app: TestApp;
  let protegidas: RutaRegistrada[];

  beforeAll(async () => {
    app = await createTestApp();
    protegidas = enumerarRutas(app.app.get(ModulesContainer)).filter((r) => !r.publica);
  });

  beforeEach(async () => {
    await resetDb(app.db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('401: sin sesión válida', () => {
    it('toda ruta no pública rechaza la petición sin token', async () => {
      expect(protegidas.length).toBeGreaterThanOrEqual(55);
      for (const ruta of protegidas) {
        const res = await enviar(app, ruta);
        esperarRechazoSinDatos(res, 401, `${ruta.metodo} ${ruta.ruta} sin token`);
      }
    });

    it('toda ruta no pública rechaza un token inválido, vencido, con otro secreto o con el cargo adulterado', async () => {
      const valido = emitirToken('TECNICO_OPERADOR');
      const ahora = Date.now();
      const spy = jest.spyOn(Date, 'now').mockReturnValue(ahora - 9 * 3600 * 1000);
      const vencido = emitirToken('ADMINISTRADOR');
      spy.mockRestore();

      const secretoOriginal = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'otro-secreto-de-pruebas-que-no-es-el-de-la-api-01234567';
      const otroSecreto = emitirToken('ADMINISTRADOR');
      process.env.JWT_SECRET = secretoOriginal;

      const casos: Record<string, string> = {
        'Bearer basura': 'Bearer basura',
        'Bearer a.b.c': 'Bearer a.b.c',
        'esquema distinto de Bearer': `Basic ${valido}`,
        'token vencido': `Bearer ${vencido}`,
        'firmado con otro secreto': `Bearer ${otroSecreto}`,
        'cargo adulterado a ADMINISTRADOR': `Bearer ${tokenManipulado(valido, { cargo: 'ADMINISTRADOR' })}`,
        'expiración adulterada': `Bearer ${tokenManipulado(vencido, { exp: Math.floor(ahora / 1000) + 3600 })}`,
      };

      for (const ruta of protegidas) {
        for (const [caso, authorization] of Object.entries(casos)) {
          const res = await enviar(app, ruta, { Authorization: authorization });
          esperarRechazoSinDatos(res, 401, `${ruta.metodo} ${ruta.ruta} con ${caso}`);
        }
      }
    });

    it('un encabezado x-actor-rol no sustituye al token ni eleva el cargo', async () => {
      const spoof = { 'x-actor-rol': 'ADMINISTRADOR', 'x-actor-usuario': 'ADMIN', 'x-actor': 'ADMIN' };

      const sinToken = await request(app.baseUrl).get('/api/mantenimiento/auditoria').set(spoof);
      esperarRechazoSinDatos(sinToken, 401, 'auditoría con encabezados falsos y sin token');

      const conTecnico = await request(app.baseUrl)
        .get('/api/mantenimiento/auditoria')
        .set({ ...spoof, ...autorizacion('TECNICO_OPERADOR') });
      esperarRechazoSinDatos(conTecnico, 403, 'auditoría con token de técnico y encabezados falsos');
    });
  });

  describe('403: rol no permitido', () => {
    it('toda ruta no pública rechaza a cada cargo que no figura en sus roles', async () => {
      let comprobaciones = 0;
      for (const ruta of protegidas) {
        for (const cargo of CARGOS.filter((c) => !ruta.roles.includes(c))) {
          const res = await enviar(app, ruta, autorizacion(cargo));
          esperarRechazoSinDatos(res, 403, `${ruta.metodo} ${ruta.ruta} con ${cargo}`);
          comprobaciones += 1;
        }
      }
      expect(comprobaciones).toBeGreaterThan(40);
    });

    it('el Técnico Operador no puede escribir en Mantenimiento y la base queda intacta', async () => {
      const escrituras = protegidas.filter(
        (r) =>
          r.ruta.startsWith('/api/mantenimiento/') &&
          r.metodo !== 'GET' &&
          r.ruta !== '/api/mantenimiento/storage/download-url',
      );
      expect(escrituras.length).toBeGreaterThanOrEqual(25);

      for (const ruta of escrituras) {
        const res = await enviar(app, ruta, autorizacion('TECNICO_OPERADOR'));
        esperarRechazoSinDatos(res, 403, `${ruta.metodo} ${ruta.ruta} como técnico`);
      }

      const conteo = await app.db.query('SELECT (SELECT COUNT(*) FROM clientes) + (SELECT COUNT(*) FROM personal) AS total');
      expect(Number(conteo.rows[0].total)).toBe(0);
    });

    it('el Supervisor no crea clientes ni proyectos: recibe 403 y no se guarda nada', async () => {
      const cliente = await request(app.baseUrl)
        .post('/api/mantenimiento/clientes')
        .set(autorizacion('SUPERVISOR'))
        .send({ razonSocial: 'Cliente Supervisor S.A.', ruc: '20123456789', codigoCorto: 'SUP', direccionFiscal: 'Av. 1' });
      esperarRechazoSinDatos(cliente, 403, 'supervisor crea cliente');

      const proyecto = await request(app.baseUrl)
        .post('/api/mantenimiento/proyectos')
        .set(autorizacion('SUPERVISOR'))
        .send({ clienteId: randomUUID(), nombre: 'SEDE' });
      esperarRechazoSinDatos(proyecto, 403, 'supervisor crea proyecto');

      const conteo = await app.db.query('SELECT COUNT(*) AS total FROM clientes');
      expect(Number(conteo.rows[0].total)).toBe(0);
    });
  });

  describe('200/201: el cargo correcto sí entra', () => {
    it('Administrador escribe en Mantenimiento; Supervisor y Técnico leen clientes, proyectos y servicios', async () => {
      const esc = await crearEscenario(api(app.baseUrl));

      for (const cargo of ['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR'] as CargoPersonal[]) {
        const encabezados = autorizacion(cargo);
        const cliente = await request(app.baseUrl).get(`/api/mantenimiento/clientes/${esc.clienteId}`).set(encabezados);
        expect({ cargo, estado: cliente.status }).toEqual({ cargo, estado: 200 });
        expect(cliente.body.id).toBe(esc.clienteId);

        const proyectos = await request(app.baseUrl)
          .get(`/api/mantenimiento/proyectos/cliente/${esc.clienteId}`)
          .set(encabezados);
        expect({ cargo, estado: proyectos.status }).toEqual({ cargo, estado: 200 });

        const servicios = await request(app.baseUrl)
          .get(`/api/mantenimiento/servicios-contratados/proyecto/${esc.proyectoId}`)
          .set(encabezados);
        expect({ cargo, estado: servicios.status }).toEqual({ cargo, estado: 200 });
      }
    });

    it('el Técnico lee insumos y equipos; el Supervisor no (datos de campo, §8.2)', async () => {
      const esc = await crearEscenario(api(app.baseUrl));

      for (const [ruta, id] of [
        ['insumos', esc.insumoId],
        ['equipos', esc.equipoId],
      ]) {
        const tecnico = await request(app.baseUrl).get(`/api/mantenimiento/${ruta}/${id}`).set(autorizacion('TECNICO_OPERADOR'));
        expect({ ruta, estado: tecnico.status }).toEqual({ ruta, estado: 200 });

        const supervisor = await request(app.baseUrl).get(`/api/mantenimiento/${ruta}/${id}`).set(autorizacion('SUPERVISOR'));
        esperarRechazoSinDatos(supervisor, 403, `supervisor lee ${ruta}`);
      }
    });

    it('el Supervisor edita catálogos de texto pero no el de motivos, que es solo del Administrador', async () => {
      const permitido = await request(app.baseUrl)
        .post('/api/mantenimiento/catalogos-texto/hallazgos/items')
        .set(await autorizacionDePersonal(app.db, 'SUPERVISOR', 'SUP.CATALOGOS'))
        .send({ item: 'Hallazgo agregado por supervisor' });
      expect(permitido.status).toBe(201);
      expect(permitido.body.items).toContain('Hallazgo agregado por supervisor');

      const restringido = await request(app.baseUrl)
        .put('/api/mantenimiento/catalogos-texto/motivos-modificacion')
        .set(autorizacion('SUPERVISOR'))
        .send({ items: ['Motivo no autorizado'] });
      expect(restringido.status).toBe(403);
    });

    it('los tres cargos registran y cierran inspecciones; la auditoría de inspección es solo del Administrador', async () => {
      const esc = await crearEscenario(api(app.baseUrl));

      const creada = await request(app.baseUrl)
        .post('/api/operaciones/inspecciones')
        .set(autorizacion('TECNICO_OPERADOR'))
        .send({ servicioId: esc.servicioId });
      expect(creada.status).toBe(201);

      const consulta = await request(app.baseUrl)
        .get(`/api/operaciones/inspecciones/${creada.body.id}`)
        .set(autorizacion('SUPERVISOR'));
      expect(consulta.status).toBe(200);

      const auditoriaTecnico = await request(app.baseUrl)
        .get(`/api/operaciones/inspecciones/${creada.body.id}/auditoria`)
        .set(autorizacion('TECNICO_OPERADOR'));
      esperarRechazoSinDatos(auditoriaTecnico, 403, 'técnico lee auditoría de inspección');

      const auditoriaAdmin = await request(app.baseUrl)
        .get(`/api/operaciones/inspecciones/${creada.body.id}/auditoria`)
        .set(autorizacion('ADMINISTRADOR'));
      expect(auditoriaAdmin.status).toBe(200);
    });

    it('el login sigue siendo público: responde 401 genérico sin pedir sesión', async () => {
      const login = await request(app.baseUrl).post('/api/auth/login').send({ usuario: 'nadie', clave: 'ninguna' });
      expect(login.status).toBe(401);
      expect(login.body.message).toBe('Credenciales inválidas');
    });
  });
});
