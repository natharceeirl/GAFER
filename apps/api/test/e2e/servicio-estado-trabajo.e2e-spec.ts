/**
 * servicio-estado-trabajo.e2e-spec.ts
 * GAF-99: estado del trabajo del servicio contratado contra PostgreSQL real, y la migración 004 (sube y baja).
 *
 * Historial de versiones
 *   v1.0  2026-11-15  ihuayhuam  Creación del archivo.
 */
import { Client } from 'pg';
import { createTestApp, TestApp } from '../support/app';
import { autorizacionDePersonal } from '../support/auth';
import { assertTestDatabase, TEST_DATABASE_URL } from '../support/config';
import { resetDb } from '../support/db';
import { api, Api, crearEscenario } from '../support/fixtures';
import { leerMigraciones } from '../../src/database/migrator';

const ruta = (id: string) => `/mantenimiento/servicios-contratados/${id}/estado`;

describe('Estado de trabajo del servicio contratado (GAF-99)', () => {
  let t: TestApp;
  let http: Api;
  let admin: Record<string, string>;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
  });

  beforeEach(async () => {
    await resetDb(t.db);
    admin = await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'ADMIN.GAF99');
  });

  afterAll(async () => {
    await t.close();
  });

  it('un servicio nuevo nace PROGRAMADO y las lecturas devuelven el estado de trabajo junto a la baja lógica', async () => {
    const { servicioId, proyectoId } = await crearEscenario(http);

    const uno = await http.get(`/mantenimiento/servicios-contratados/${servicioId}`, admin);
    expect(uno.status).toBe(200);
    expect(uno.body).toEqual(expect.objectContaining({ estado: 'ACTIVO', estadoTrabajo: 'PROGRAMADO' }));

    const lista = await http.get(`/mantenimiento/servicios-contratados/proyecto/${proyectoId}`, admin);
    expect(lista.body.map((s: { estadoTrabajo: string }) => s.estadoTrabajo)).toEqual(['PROGRAMADO']);
  });

  it('recorre PROGRAMADO → EJECUTADO → CONCLUIDO, reabre con motivo y deja cada transición en la auditoría', async () => {
    const { servicioId } = await crearEscenario(http);

    const ejecutar = await http.patch(ruta(servicioId), { estado: 'EJECUTADO' }, admin);
    expect(ejecutar.status).toBe(200);
    expect(ejecutar.body).toEqual(expect.objectContaining({ id: servicioId, estadoTrabajo: 'EJECUTADO', estado: 'ACTIVO' }));

    expect((await http.patch(ruta(servicioId), { estado: 'CONCLUIDO' }, admin)).body.estadoTrabajo).toBe('CONCLUIDO');

    const reabrir = await http.patch(ruta(servicioId), { estado: 'EJECUTADO', motivo: '  Faltó tratar el almacén  ' }, admin);
    expect(reabrir.status).toBe(200);
    expect(reabrir.body.estadoTrabajo).toBe('EJECUTADO');

    const fila = await t.db.query('SELECT estado_trabajo FROM servicios_contratados WHERE id = $1', [servicioId]);
    expect(fila.rows[0].estado_trabajo).toBe('EJECUTADO');

    const auditoria = await http.get(`/mantenimiento/auditoria?entidad=servicio_contratado&entidadId=${servicioId}`, admin);
    expect(auditoria.status).toBe(200);
    const eventos = [...auditoria.body.items].reverse();
    expect(eventos.map((e: Record<string, unknown>) => [e.accion, e.payloadAnterior, e.payloadNuevo, e.actorUsuario, e.actorRol])).toEqual([
      ['CAMBIAR_ESTADO_TRABAJO_SERVICIO', { estadoTrabajo: 'PROGRAMADO' }, { estadoTrabajo: 'EJECUTADO', motivo: null }, 'ADMIN.GAF99', 'ADMINISTRADOR'],
      ['CAMBIAR_ESTADO_TRABAJO_SERVICIO', { estadoTrabajo: 'EJECUTADO' }, { estadoTrabajo: 'CONCLUIDO', motivo: null }, 'ADMIN.GAF99', 'ADMINISTRADOR'],
      ['REABRIR_SERVICIO', { estadoTrabajo: 'CONCLUIDO' }, { estadoTrabajo: 'EJECUTADO', motivo: 'Faltó tratar el almacén' }, 'ADMIN.GAF99', 'ADMINISTRADOR'],
    ]);
  });

  it('cancela con motivo; sin motivo o con uno corto responde 400 señalando el campo', async () => {
    const { servicioId } = await crearEscenario(http);

    const sinMotivo = await http.patch(ruta(servicioId), { estado: 'CANCELADO' }, admin);
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.errors).toEqual([expect.objectContaining({ path: 'motivo' })]);

    const corto = await http.patch(ruta(servicioId), { estado: 'CANCELADO', motivo: 'no' }, admin);
    expect(corto.status).toBe(400);
    expect(corto.body.errors).toEqual([expect.objectContaining({ path: 'motivo' })]);

    const ok = await http.patch(ruta(servicioId), { estado: 'CANCELADO', motivo: 'El cliente suspendió el contrato' }, admin);
    expect(ok.status).toBe(200);
    expect(ok.body.estadoTrabajo).toBe('CANCELADO');
  });

  it('responde 400 a una transición no permitida y a reabrir sin motivo, sin cambiar el estado ni auditar', async () => {
    const { servicioId } = await crearEscenario(http);

    const saltar = await http.patch(ruta(servicioId), { estado: 'CONCLUIDO' }, admin);
    expect(saltar.status).toBe(400);
    expect(saltar.body.message).toBe('No se puede pasar el servicio de PROGRAMADO a CONCLUIDO');

    await http.patch(ruta(servicioId), { estado: 'CANCELADO', motivo: 'Cliente suspendió' }, admin);
    const reabrirSinMotivo = await http.patch(ruta(servicioId), { estado: 'EJECUTADO' }, admin);
    expect(reabrirSinMotivo.status).toBe(400);
    expect(reabrirSinMotivo.body.errors).toEqual([{ path: 'motivo', message: expect.stringMatching(/reabrir/) }]);

    const estadoInvalido = await http.patch(ruta(servicioId), { estado: 'ACTIVO' }, admin);
    expect(estadoInvalido.status).toBe(400);

    expect((await http.get(`/mantenimiento/servicios-contratados/${servicioId}`, admin)).body.estadoTrabajo).toBe('CANCELADO');
    const auditoria = await http.get(`/mantenimiento/auditoria?entidad=servicio_contratado&entidadId=${servicioId}`, admin);
    expect(auditoria.body.total).toBe(1);
  });

  it('404 si el servicio no existe', async () => {
    const res = await http.patch(ruta('7d0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a99'), { estado: 'EJECUTADO' }, admin);
    expect(res.status).toBe(404);
  });

  it.each(['SUPERVISOR', 'TECNICO_OPERADOR'] as const)('%s lee el estado pero recibe 403 al cambiarlo', async (cargo) => {
    const { servicioId } = await crearEscenario(http);
    const otro = api(t.baseUrl, cargo);

    expect((await otro.get(`/mantenimiento/servicios-contratados/${servicioId}`)).body.estadoTrabajo).toBe('PROGRAMADO');
    const res = await otro.patch(ruta(servicioId), { estado: 'EJECUTADO' });
    expect(res.status).toBe(403);

    expect((await http.get(`/mantenimiento/servicios-contratados/${servicioId}`, admin)).body.estadoTrabajo).toBe('PROGRAMADO');
  });

  it('activar y desactivar siguen funcionando y no tocan el estado de trabajo; un servicio inactivo no cambia de estado', async () => {
    const { servicioId } = await crearEscenario(http);
    await http.patch(ruta(servicioId), { estado: 'EJECUTADO' }, admin);

    const baja = await http.patch(`/mantenimiento/servicios-contratados/${servicioId}/desactivar`, {}, admin);
    expect(baja.body).toEqual({ id: servicioId, estado: 'INACTIVO' });
    expect((await http.patch(ruta(servicioId), { estado: 'CONCLUIDO' }, admin)).status).toBe(400);

    await http.patch(`/mantenimiento/servicios-contratados/${servicioId}/activar`, {}, admin);
    const leido = await http.get(`/mantenimiento/servicios-contratados/${servicioId}`, admin);
    expect(leido.body).toEqual(expect.objectContaining({ estado: 'ACTIVO', estadoTrabajo: 'EJECUTADO' }));
  });

  it('la base rechaza un estado de trabajo fuera de los cuatro valores (CHECK), incluido PENDIENTE', async () => {
    const { servicioId } = await crearEscenario(http);
    await expect(
      t.db.query(`UPDATE servicios_contratados SET estado_trabajo = 'ACTIVO' WHERE id = $1`, [servicioId]),
    ).rejects.toThrow(/chk_servicios_estado_trabajo/);
    await expect(
      t.db.query(`UPDATE servicios_contratados SET estado_trabajo = 'PENDIENTE' WHERE id = $1`, [servicioId]),
    ).rejects.toThrow(/chk_servicios_estado_trabajo/);
  });

  it('el Administrador no puede fijar PENDIENTE a mano (400)', async () => {
    const { servicioId } = await crearEscenario(http);
    const res = await http.patch(ruta(servicioId), { estado: 'PENDIENTE' }, admin);
    expect(res.status).toBe(400);
  });

  describe('estado visible: PENDIENTE se deriva de la fecha programada', () => {
    async function programar(servicioId: string, proyectoId: string, fecha: string) {
      const sede = await t.db.query('SELECT cliente_id FROM proyectos WHERE id = $1', [proyectoId]);
      await t.db.query(
        `INSERT INTO visitas (cliente_id, proyecto_id, servicio_id, fecha, hora) VALUES ($1, $2, $3, $4, '09:00')`,
        [sede.rows[0].cliente_id, proyectoId, servicioId, fecha],
      );
    }
    const leer = async (id: string) => (await http.get(`/mantenimiento/servicios-contratados/${id}`, admin)).body;

    it('sin visita programada, el servicio PROGRAMADO se ve PROGRAMADO y sin fecha', async () => {
      const { servicioId } = await crearEscenario(http);
      expect(await leer(servicioId)).toEqual(expect.objectContaining({ estadoTrabajo: 'PROGRAMADO', estadoVisible: 'PROGRAMADO', fechaProgramada: null }));
    });

    it('con la visita programada vencida, se ve PENDIENTE aunque se guarda PROGRAMADO', async () => {
      const { servicioId, proyectoId } = await crearEscenario(http);
      await programar(servicioId, proyectoId, '2020-01-15');
      expect(await leer(servicioId)).toEqual(expect.objectContaining({ estadoTrabajo: 'PROGRAMADO', estadoVisible: 'PENDIENTE', fechaProgramada: '2020-01-15' }));
      const lista = await http.get(`/mantenimiento/servicios-contratados/proyecto/${proyectoId}`, admin);
      expect(lista.body[0]).toEqual(expect.objectContaining({ estadoVisible: 'PENDIENTE' }));
    });

    it('con la visita en el futuro, sigue PROGRAMADO; se usa la visita pendiente más próxima', async () => {
      const { servicioId, proyectoId } = await crearEscenario(http);
      await programar(servicioId, proyectoId, '2099-12-31');
      await programar(servicioId, proyectoId, '2098-06-01');
      expect(await leer(servicioId)).toEqual(expect.objectContaining({ estadoVisible: 'PROGRAMADO', fechaProgramada: '2098-06-01' }));
    });

    it('al ejecutarse deja de ser PENDIENTE', async () => {
      const { servicioId, proyectoId } = await crearEscenario(http);
      await programar(servicioId, proyectoId, '2020-01-15');
      const res = await http.patch(ruta(servicioId), { estado: 'EJECUTADO' }, admin);
      expect(res.body).toEqual(expect.objectContaining({ estadoTrabajo: 'EJECUTADO', estadoVisible: 'EJECUTADO' }));
    });
  });
});

/** La migración 004 se prueba en una base aparte para no tocar el esquema de las demás suites. */
describe('Migración 004_servicio_estado_trabajo (sube y baja)', () => {
  const base = new URL(TEST_DATABASE_URL);
  const nombreBase = `${assertTestDatabase(TEST_DATABASE_URL).replace(/_test$/, '')}_mig004_test`;
  const urlMigracion = new URL(TEST_DATABASE_URL);
  urlMigracion.pathname = `/${nombreBase}`;
  let db: Client;

  async function administrar(sql: string) {
    const admin = new URL(base.toString());
    admin.pathname = '/postgres';
    const cliente = new Client({ connectionString: admin.toString() });
    await cliente.connect();
    try {
      await cliente.query(sql);
    } finally {
      await cliente.end();
    }
  }

  async function aplicar(direccion: 'up' | 'down', nombres: string[]) {
    for (const m of await leerMigraciones(direccion)) {
      if (nombres.some((n) => m.nombre.startsWith(n))) await db.query(m.sql);
    }
  }

  async function estadoDe(id: string): Promise<string> {
    return (await db.query('SELECT estado_trabajo FROM servicios_contratados WHERE id = $1', [id])).rows[0].estado_trabajo;
  }

  beforeAll(async () => {
    assertTestDatabase(urlMigracion.toString());
    await administrar(`DROP DATABASE IF EXISTS "${nombreBase}"`);
    await administrar(`CREATE DATABASE "${nombreBase}"`);
    db = new Client({ connectionString: urlMigracion.toString() });
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
    await administrar(`DROP DATABASE IF EXISTS "${nombreBase}"`);
  });

  it('siembra EJECUTADO a los servicios con inspecciones y PROGRAMADO al resto; reaplicarla no pisa los cambios; baja y vuelve a subir', async () => {
    await aplicar('up', ['001_', '002_']);
    const cliente = await db.query(
      `INSERT INTO clientes (razon_social, ruc, codigo_corto, direccion_fiscal, giro_negocio, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo)
       VALUES ('Cliente Migración S.A.', '20999888777', 'MIG004', 'Av. 1', 'Energía', 'Ana', 'Jefa', '959000111', 'ana@mig.pe') RETURNING id`,
    );
    const sede = await db.query(
      `INSERT INTO proyectos (cliente_id, nombre, direccion_sede, distrito, provincia, departamento, contacto_nombre, contacto_cargo, contacto_telefono)
       VALUES ($1, 'PLANTA', 'Calle 1', 'Mollendo', 'Islay', 'Arequipa', 'Ana', 'Jefa', '959000111') RETURNING id`,
      [cliente.rows[0].id],
    );
    const servicio = async () =>
      (
        await db.query(
          `INSERT INTO servicios_contratados (proyecto_id, tipo_servicio, frecuencia, area_total_m2, area_tratar_m2)
           VALUES ($1, 'DRT', 'MENSUAL', 100, 50) RETURNING id`,
          [sede.rows[0].id],
        )
      ).rows[0].id as string;
    const conInspeccion = await servicio();
    const sinInspeccion = await servicio();
    await db.query(
      `INSERT INTO inspecciones (servicio_id, codigo_inspeccion, fecha_ejecucion) VALUES ($1, 'INS-MIG-001', '2026-11-01')`,
      [conInspeccion],
    );

    await aplicar('up', ['004_']);
    expect(await estadoDe(conInspeccion)).toBe('EJECUTADO');
    expect(await estadoDe(sinInspeccion)).toBe('PROGRAMADO');

    // El migrador vuelve a ejecutar todas las migraciones en cada corrida: 004 no debe pisar los cambios hechos después.
    await db.query(`UPDATE servicios_contratados SET estado_trabajo = 'CONCLUIDO' WHERE id = $1`, [conInspeccion]);
    await db.query(`UPDATE servicios_contratados SET estado_trabajo = 'CANCELADO' WHERE id = $1`, [sinInspeccion]);
    await aplicar('up', ['001_', '002_', '004_']);
    expect(await estadoDe(conInspeccion)).toBe('CONCLUIDO');
    expect(await estadoDe(sinInspeccion)).toBe('CANCELADO');

    await expect(
      db.query(`UPDATE servicios_contratados SET estado_trabajo = 'ACTIVO' WHERE id = $1`, [sinInspeccion]),
    ).rejects.toThrow(/chk_servicios_estado_trabajo/);

    await aplicar('down', ['004_']);
    const columnas = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'servicios_contratados' AND column_name = 'estado_trabajo'`,
    );
    expect(columnas.rowCount).toBe(0);

    await aplicar('up', ['004_']);
    expect(await estadoDe(conInspeccion)).toBe('EJECUTADO');
    expect(await estadoDe(sinInspeccion)).toBe('PROGRAMADO');

    // La bajada completa (004 primero, luego 002 y 001) deja la base vacía sin errores.
    await aplicar('down', ['004_', '002_', '001_']);
    const tablas = await db.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'servicios_contratados'`);
    expect(tablas.rowCount).toBe(0);
  });

  it('actualiza una base que ya aplicó la versión anterior de 004 (PENDIENTE, EN_CURSO, COMPLETADO): pasa los valores y es idempotente', async () => {
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await aplicar('up', ['001_', '002_']);
    await db.query(
      `ALTER TABLE servicios_contratados
         ADD COLUMN estado_trabajo VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
         CONSTRAINT chk_servicios_estado_trabajo CHECK (estado_trabajo IN ('PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO'))`,
    );
    const cliente = await db.query(
      `INSERT INTO clientes (razon_social, ruc, codigo_corto, direccion_fiscal, giro_negocio, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo)
       VALUES ('Cliente Legado S.A.', '20999888666', 'LEG004', 'Av. 1', 'Energía', 'Ana', 'Jefa', '959000111', 'ana@leg.pe') RETURNING id`,
    );
    const sede = await db.query(
      `INSERT INTO proyectos (cliente_id, nombre, direccion_sede, distrito, provincia, departamento, contacto_nombre, contacto_cargo, contacto_telefono)
       VALUES ($1, 'PLANTA', 'Calle 1', 'Mollendo', 'Islay', 'Arequipa', 'Ana', 'Jefa', '959000111') RETURNING id`,
      [cliente.rows[0].id],
    );
    const ids: Record<string, string> = {};
    for (const estado of ['PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO']) {
      ids[estado] = (
        await db.query(
          `INSERT INTO servicios_contratados (proyecto_id, tipo_servicio, frecuencia, area_total_m2, area_tratar_m2, estado_trabajo)
           VALUES ($1, 'DRT', 'MENSUAL', 100, 50, $2) RETURNING id`,
          [sede.rows[0].id, estado],
        )
      ).rows[0].id;
    }

    for (let corrida = 0; corrida < 2; corrida += 1) {
      await aplicar('up', ['004_']);
      expect(await estadoDe(ids.PENDIENTE)).toBe('PROGRAMADO');
      expect(await estadoDe(ids.EN_CURSO)).toBe('EJECUTADO');
      expect(await estadoDe(ids.COMPLETADO)).toBe('CONCLUIDO');
      expect(await estadoDe(ids.CANCELADO)).toBe('CANCELADO');
    }

    await expect(
      db.query(`UPDATE servicios_contratados SET estado_trabajo = 'PENDIENTE' WHERE id = $1`, [ids.PENDIENTE]),
    ).rejects.toThrow(/chk_servicios_estado_trabajo/);
    const porDefecto = await db.query(
      `INSERT INTO servicios_contratados (proyecto_id, tipo_servicio, frecuencia, area_total_m2, area_tratar_m2)
       VALUES ($1, 'DRT', 'MENSUAL', 100, 50) RETURNING estado_trabajo`,
      [sede.rows[0].id],
    );
    expect(porDefecto.rows[0].estado_trabajo).toBe('PROGRAMADO');
  });
});
