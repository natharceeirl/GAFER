/**
 * documentos.e2e-spec.ts
 * Endpoints de documentos contra la aplicación real: creación numerada, cola de revisión,
 * historial de transiciones y roles (GAF-47, GAF-49).
 */
import { randomUUID } from 'crypto';
import { createTestApp, TestApp } from '../support/app';
import { autorizacion, autorizacionDePersonal } from '../support/auth';
import { resetDb } from '../support/db';
import { api, Api, crearEscenario } from '../support/fixtures';

describe('API de documentos (GAF-47, GAF-49)', () => {
  let t: TestApp;
  let http: Api;
  let clienteId: string;
  let proyectoId: string;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
  });

  beforeEach(async () => {
    await resetDb(t.db);
    const esc = await crearEscenario(http);
    clienteId = esc.clienteId;
    proyectoId = esc.proyectoId;
  });

  afterAll(async () => {
    await t.close();
  });

  async function crear(tipo = 'INFORME', cargo: 'ADMINISTRADOR' | 'SUPERVISOR' = 'SUPERVISOR', extra: object = {}) {
    return http.post('/documentos', { clienteId, tipo, ...extra }, await autorizacionDePersonal(t.db, cargo, cargo === 'SUPERVISOR' ? 'SUP.UNO' : 'ADM.UNO'));
  }

  async function transicionar(id: string, nuevoEstado: string, motivo?: string) {
    return http.post(`/documentos/${id}/transicion`, { nuevoEstado, motivo }, await autorizacionDePersonal(t.db, 'SUPERVISOR', 'SUP.UNO'));
  }

  it('crea un documento numerado por cliente y tipo, con código y sede', async () => {
    const a = await crear('INFORME', 'SUPERVISOR', { proyectoId });
    const b = await crear('INFORME', 'ADMINISTRADOR');
    const c = await crear('REPORTE');
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ tipo: 'INFORME', numeroCorrelativo: 1, estado: 'BORRADOR' });
    expect(a.body.codigo).toMatch(/^INFORME-QA\d{3}-001-\d{4}$/);
    expect(b.body.numeroCorrelativo).toBe(2);
    expect(c.body.numeroCorrelativo).toBe(1);

    const detalle = await http.get(`/documentos/${a.body.id}`, autorizacion('SUPERVISOR'));
    expect(detalle.body.proyecto).toMatch(/^PLANTA_/);
  });

  it('peticiones simultáneas por HTTP no repiten ni saltan números', async () => {
    await autorizacionDePersonal(t.db, 'SUPERVISOR', 'SUP.UNO'); // el usuario ya existe: las peticiones no compiten por crearlo
    const respuestas = await Promise.all(Array.from({ length: 20 }, () => crear('INFORME')));
    expect(respuestas.every((r) => r.status === 201)).toBe(true);
    expect(respuestas.map((r) => r.body.numeroCorrelativo).sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('valida el cuerpo con mensajes en español', async () => {
    const sinTipo = await http.post('/documentos', { clienteId }, autorizacion('SUPERVISOR'));
    expect(sinTipo.status).toBe(400);
    expect(sinTipo.body.message).toContain('tipo: El campo tipo es obligatorio y debe ser INFORME o REPORTE');

    const sinCliente = await http.post('/documentos', { tipo: 'INFORME' }, autorizacion('SUPERVISOR'));
    expect(sinCliente.status).toBe(400);
    expect(sinCliente.body.message).toContain('clienteId: El campo clienteId es obligatorio');

    const estadoRaro = await transicionar(randomUUID(), 'EMITIDO');
    expect(estadoRaro.status).toBe(400);
    expect(estadoRaro.body.message).toContain('nuevoEstado: Estado desconocido');
  });

  it('cliente inexistente responde 404 y no consume número', async () => {
    const res = await http.post('/documentos', { clienteId: randomUUID(), tipo: 'INFORME' }, autorizacion('SUPERVISOR'));
    expect(res.status).toBe(404);
    const ok = await crear();
    expect(ok.body.numeroCorrelativo).toBe(1);
  });

  it('un documento cerrado aparece en la cola de revisión y llega a aprobado con su historial', async () => {
    const doc = (await crear()).body;
    const otro = (await crear('REPORTE')).body;
    expect((await transicionar(doc.id, 'CERRADO')).status).toBe(201);
    expect((await transicionar(doc.id, 'ENVIADO_A_REVISION', 'Listo para revisión')).body.estado).toBe('ENVIADO_A_REVISION');

    const cola = await http.get('/documentos?estado=ENVIADO_A_REVISION', autorizacion('SUPERVISOR'));
    expect(cola.status).toBe(200);
    expect(cola.body.map((d: { id: string }) => d.id)).toEqual([doc.id]);
    expect(cola.body[0]).toMatchObject({ codigo: doc.codigo, tipo: 'INFORME', estado: 'ENVIADO_A_REVISION', cliente: expect.stringMatching(/^Cliente Prueba/) });

    expect((await transicionar(doc.id, 'APROBADO')).body.estado).toBe('APROBADO');
    expect((await http.get('/documentos?estado=ENVIADO_A_REVISION', autorizacion('ADMINISTRADOR'))).body).toEqual([]);
    expect((await http.get('/documentos', autorizacion('ADMINISTRADOR'))).body).toHaveLength(2);
    expect((await http.get('/documentos?tipo=REPORTE', autorizacion('ADMINISTRADOR'))).body.map((d: { id: string }) => d.id)).toEqual([otro.id]);

    const detalle = await http.get(`/documentos/${doc.id}`, autorizacion('SUPERVISOR'));
    expect(detalle.status).toBe(200);
    expect(detalle.body.transiciones.map((x: { estadoAnterior: string | null; estadoNuevo: string; motivo: string | null }) => [x.estadoAnterior, x.estadoNuevo, x.motivo])).toEqual([
      [null, 'BORRADOR', null],
      ['BORRADOR', 'CERRADO', null],
      ['CERRADO', 'ENVIADO_A_REVISION', 'Listo para revisión'],
      ['ENVIADO_A_REVISION', 'APROBADO', null],
    ]);
    expect(detalle.body.transiciones[1]).toMatchObject({ actorUsuario: 'SUP.UNO', actorRol: 'SUPERVISOR' });
  });

  it('una transición no permitida responde 400 y no altera el estado ni el historial', async () => {
    const doc = (await crear()).body;
    const res = await transicionar(doc.id, 'APROBADO');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No se puede pasar de BORRADOR a APROBADO');
    const detalle = await http.get(`/documentos/${doc.id}`, autorizacion('SUPERVISOR'));
    expect(detalle.body.estado).toBe('BORRADOR');
    expect(detalle.body.transiciones).toHaveLength(1);
  });

  it('documento inexistente o identificador mal formado', async () => {
    expect((await http.get(`/documentos/${randomUUID()}`, autorizacion('SUPERVISOR'))).status).toBe(404);
    expect((await http.get('/documentos/no-es-uuid', autorizacion('SUPERVISOR'))).status).toBe(400);
    expect((await transicionar(randomUUID(), 'CERRADO')).status).toBe(404);
    expect((await http.get('/documentos?estado=PENDIENTE', autorizacion('SUPERVISOR'))).status).toBe(400);
  });

  it('el Técnico Operador no lista, consulta, crea ni transiciona (solo móvil): 403', async () => {
    const doc = (await crear()).body;
    const tecnico = autorizacion('TECNICO_OPERADOR');
    expect((await http.get('/documentos', tecnico)).status).toBe(403);
    expect((await http.get(`/documentos/${doc.id}`, tecnico)).status).toBe(403);
    expect((await http.post('/documentos', { clienteId, tipo: 'INFORME' }, tecnico)).status).toBe(403);
    expect((await http.post(`/documentos/${doc.id}/transicion`, { nuevoEstado: 'CERRADO' }, tecnico)).status).toBe(403);
    const filas = await t.db.query('SELECT COUNT(*)::int AS n FROM documentos');
    expect(filas.rows[0].n).toBe(1);
  });

  it('crear y transicionar quedan en la auditoría del módulo DOCUMENTOS', async () => {
    const doc = (await crear()).body;
    await transicionar(doc.id, 'CERRADO', 'Cierre');
    const eventos = await t.db.query(
      `SELECT accion, actor_usuario FROM auditoria_eventos WHERE modulo = 'DOCUMENTOS' AND entidad_id = $1 ORDER BY created_at`,
      [doc.id],
    );
    expect(eventos.rows).toEqual([
      { accion: 'CREAR', actor_usuario: 'SUP.UNO' },
      { accion: 'TRANSICION', actor_usuario: 'SUP.UNO' },
    ]);
  });
});
