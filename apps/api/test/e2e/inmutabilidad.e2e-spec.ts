/**
 * T3.1 — Suite de integración de INMUTABILIDAD CONTRACTUAL (Sección 13 de la especificación v6).
 *
 * Regla bajo prueba: "agregar o editar cualquier catálogo NUNCA afecta la información ya registrada
 * en servicios anteriores". GAFER verificará esto en la entrega (es condición de pago de la fase).
 *
 * Estas pruebas levantan la API real (NestJS + Kysely) contra PostgreSQL real (base gafer_test),
 * a diferencia de src/operaciones/inmutabilidad.spec.ts que usa repositorios falsos en memoria.
 *
 * Secciones:
 *   A. Lectura del histórico (inspección CERRADA sembrada en BD)  -> no depende del flujo de cierre
 *   B. Flujo completo por la API: crear -> cerrar -> editar catálogo
 *   C. Guardas de la base de datos
 *   D. Validaciones y errores HTTP
 *   E. Pendientes de decisión del equipo (it.todo)
 *
 * Los tests marcados con itBug('BUG-xx') dependen de un defecto abierto (ver support/known-bugs.ts).
 */
import { randomUUID } from 'crypto';
import { createTestApp, TestApp } from '../support/app';
import {
  editarInsumoEnCatalogo,
  eliminarInsumoDelCatalogo,
  leerFilaInspeccion,
  leerSnapshotCrudo,
  resetDb,
  sembrarInspeccionCerrada,
} from '../support/db';
import { Api, api, crearEscenario, Escenario } from '../support/fixtures';
import { itBug } from '../support/known-bugs';

const CAMBIOS_REFORMULACION = {
  nombre_comercial: 'Cipermetrina 50% Ultra Concentrada (REFORMULADO 2028)',
  principio_activo: 'Cipermetrina Pura',
  registro_digesa: 'RD-9999-2028/DIGESA/SA',
  concentracion: '50% p/v',
  dosis_estandar: '2.5 ml/L',
};

describe('T3.1 · Sección 13 — Inmutabilidad contractual (E2E con Postgres real)', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
  });

  beforeEach(async () => {
    await resetDb(t.db);
  });

  afterAll(async () => {
    await t.close();
  });

  // ---------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------
  const consumoDe = (esc: Escenario) => ({
    insumoId: esc.insumoId,
    dosisAplicada: '7.5 ml/L',
    lote: 'L-2026-A',
    cantidadUtilizada: 2.5,
  });

  async function crearInspeccion(esc: Escenario): Promise<string> {
    const res = await http.post('/operaciones/inspecciones', { servicioId: esc.servicioId });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  /** Inserta una inspección CERRADA con un snapshot conocido (independiente del flujo de cierre). */
  async function sembrarCerrada(esc: Escenario): Promise<{ id: string; snapshot: Record<string, unknown> }> {
    const id = randomUUID();
    const snapshot = {
      insumos: [
        {
          insumoId: esc.insumoId,
          nombreHistorico: esc.insumoOriginal.nombreComercial,
          principioActivo: esc.insumoOriginal.principioActivo,
          presentacion: 'LIQUIDO',
          unidadMedida: 'L',
          registroDigesa: esc.insumoOriginal.registroDigesa,
          concentracion: esc.insumoOriginal.concentracion,
          dosisAplicada: '7.5 ml/L',
          lote: 'L-2026-A',
          cantidadUtilizada: 2.5,
          congeladoEn: '2026-09-19T15:00:00.000Z',
        },
      ],
      fechaCierre: '2026-09-19T15:00:00.000Z',
    };
    await sembrarInspeccionCerrada(t.db, { id, servicioId: esc.servicioId, codigo: `SEED-${id.slice(0, 8)}`, snapshot });
    return { id, snapshot };
  }

  const leer = (id: string) => http.get(`/operaciones/inspecciones/${id}`);

  // ---------------------------------------------------------------------------------------------
  // A. Lectura del histórico
  // ---------------------------------------------------------------------------------------------
  describe('A. El histórico ya guardado no cambia cuando cambian los catálogos', () => {
    it('editar el insumo en el catálogo (nombre, DIGESA, concentración, dosis) no altera la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id, snapshot } = await sembrarCerrada(esc);
      const antes = await leer(id);
      expect(antes.status).toBe(200);
      expect(antes.body.snapshotCatalogos).toEqual(snapshot);

      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION);

      const despues = await leer(id);
      expect(despues.status).toBe(200);
      expect(despues.body).toEqual(antes.body);
      const item = despues.body.snapshotCatalogos.insumos[0];
      expect(item.nombreHistorico).toBe(esc.insumoOriginal.nombreComercial);
      expect(item.registroDigesa).toBe(esc.insumoOriginal.registroDigesa);
      expect(item.nombreHistorico).not.toBe(CAMBIOS_REFORMULACION.nombre_comercial);
    });

    it('desactivar el insumo (PATCH /mantenimiento/insumos/:id/desactivar) no altera la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      const res = await http.patch(`/mantenimiento/insumos/${esc.insumoId}/desactivar`);
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('INACTIVO');

      expect((await leer(id)).body).toEqual(antes.body);
    });

    it('eliminar el insumo del catálogo no rompe ni altera la inspección cerrada (el snapshot no depende de un JOIN)', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      await eliminarInsumoDelCatalogo(t.db, esc.insumoId);

      const despues = await leer(id);
      expect(despues.status).toBe(200);
      expect(despues.body).toEqual(antes.body);
    });

    it('renombrar y desactivar al cliente no altera la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      const renombrado = await http.patch(`/mantenimiento/clientes/${esc.clienteId}`, { razonSocial: 'Otro Nombre S.A.C.' });
      expect(renombrado.status).toBe(200);
      const desactivado = await http.patch(`/mantenimiento/clientes/${esc.clienteId}/desactivar`);
      expect(desactivado.status).toBe(200);

      expect((await leer(id)).body).toEqual(antes.body);
    });

    it('poner el equipo en mantenimiento y desactivar al técnico no altera la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      const equipo = await http.patch(`/mantenimiento/equipos/${esc.equipoId}/estado`, { estadoOperativo: 'FUERA_SERVICIO' });
      expect(equipo.status).toBe(200);
      const tecnico = await http.patch(`/mantenimiento/personal/${esc.tecnicoId}/desactivar`);
      expect(tecnico.status).toBe(200);

      expect((await leer(id)).body).toEqual(antes.body);
    });

    it('consultar por id y por servicioId devuelve el mismo snapshot histórico', async () => {
      const esc = await crearEscenario(http);
      const { id, snapshot } = await sembrarCerrada(esc);
      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION);

      const porId = await leer(id);
      const porServicio = await http.get(`/operaciones/inspecciones?servicioId=${esc.servicioId}`);

      expect(porId.body.snapshotCatalogos).toEqual(snapshot);
      expect(porServicio.body.snapshotCatalogos).toEqual(snapshot);
    });

    it('no se puede borrar un servicio ni un cliente que ya tienen inspecciones (FK RESTRICT)', async () => {
      const esc = await crearEscenario(http);
      await sembrarCerrada(esc);

      await expect(t.db.query('DELETE FROM servicios_contratados WHERE id = $1', [esc.servicioId])).rejects.toMatchObject({
        code: '23503',
      });
      await expect(t.db.query('DELETE FROM clientes WHERE id = $1', [esc.clienteId])).rejects.toMatchObject({ code: '23503' });
    });
  });

  // ---------------------------------------------------------------------------------------------
  // B. Flujo completo por la API
  // ---------------------------------------------------------------------------------------------
  describe('B. Flujo completo: crear inspección → cerrar con consumos → cambiar catálogo', () => {
    itBug('BUG-01', 'cerrar congela en el snapshot los datos vigentes del insumo y sube la versión de sync', async () => {
      const esc = await crearEscenario(http);
      const creada = await http.post('/operaciones/inspecciones', { servicioId: esc.servicioId });
      expect(creada.status).toBe(201);
      expect(creada.body).toMatchObject({ estado: 'BORRADOR', versionSync: 1 });

      const cierre = await http.post(`/operaciones/inspecciones/${creada.body.id}/cerrar`, { consumos: [consumoDe(esc)] });

      expect(cierre.status).toBe(201);
      expect(cierre.body).toMatchObject({ estado: 'CERRADO', versionSync: 2 });
      expect(cierre.body.snapshotCatalogos.insumos).toHaveLength(1);
      expect(cierre.body.snapshotCatalogos.insumos[0]).toMatchObject({
        insumoId: esc.insumoId,
        nombreHistorico: esc.insumoOriginal.nombreComercial,
        principioActivo: esc.insumoOriginal.principioActivo,
        registroDigesa: esc.insumoOriginal.registroDigesa,
        concentracion: esc.insumoOriginal.concentracion,
        dosisAplicada: '7.5 ml/L',
        lote: 'L-2026-A',
        cantidadUtilizada: 2.5,
      });
      expect(new Date(cierre.body.snapshotCatalogos.fechaCierre).toISOString()).toBe(cierre.body.snapshotCatalogos.fechaCierre);
    });

    itBug('BUG-01', 'editar el catálogo después del cierre deja el JSONB guardado idéntico byte a byte', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);
      const cierre = await http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] });
      expect(cierre.status).toBe(201);

      const crudoAntes = await leerSnapshotCrudo(t.db, id);
      const filaAntes = await leerFilaInspeccion(t.db, id);
      const apiAntes = await leer(id);

      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION);

      expect(await leerSnapshotCrudo(t.db, id)).toBe(crudoAntes);
      const filaDespues = await leerFilaInspeccion(t.db, id);
      expect(filaDespues.estado).toBe(filaAntes.estado);
      expect(filaDespues.version_sync).toBe(filaAntes.version_sync);
      expect((await leer(id)).body).toEqual(apiAntes.body);
    });

    itBug('BUG-01', 'desactivar y eliminar el insumo después del cierre no altera el snapshot', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);
      await http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] });
      const antes = await leer(id);
      expect(antes.body.snapshotCatalogos.insumos).toHaveLength(1);

      await http.patch(`/mantenimiento/insumos/${esc.insumoId}/desactivar`);
      await eliminarInsumoDelCatalogo(t.db, esc.insumoId);

      expect((await leer(id)).body).toEqual(antes.body);
    });

    itBug('BUG-01', 'cada inspección conserva el catálogo de SU momento (la antigua no cambia, la nueva ve la reformulación)', async () => {
      const esc = await crearEscenario(http);

      const idAntigua = await crearInspeccion(esc);
      await http.post(`/operaciones/inspecciones/${idAntigua}/cerrar`, { consumos: [consumoDe(esc)] });

      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION);

      const idNueva = await crearInspeccion(esc);
      const cierreNueva = await http.post(`/operaciones/inspecciones/${idNueva}/cerrar`, { consumos: [consumoDe(esc)] });
      expect(cierreNueva.status).toBe(201);

      const antigua = (await leer(idAntigua)).body.snapshotCatalogos.insumos[0];
      const nueva = (await leer(idNueva)).body.snapshotCatalogos.insumos[0];
      expect(antigua.nombreHistorico).toBe(esc.insumoOriginal.nombreComercial);
      expect(antigua.registroDigesa).toBe(esc.insumoOriginal.registroDigesa);
      expect(nueva.nombreHistorico).toBe(CAMBIOS_REFORMULACION.nombre_comercial);
      expect(nueva.registroDigesa).toBe(CAMBIOS_REFORMULACION.registro_digesa);
    });

    itBug('BUG-01', 'el snapshot refleja el catálogo al momento del CIERRE, no al de crear el borrador', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc); // borrador con el insumo original
      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION); // cambia ANTES de cerrar

      const cierre = await http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] });

      expect(cierre.status).toBe(201);
      expect(cierre.body.snapshotCatalogos.insumos[0].nombreHistorico).toBe(CAMBIOS_REFORMULACION.nombre_comercial);
    });

    itBug('BUG-01', 'una inspección cerrada no se puede cerrar de nuevo (409) y su snapshot y versión no cambian', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);
      const primero = await http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] });
      expect(primero.status).toBe(201);
      const crudoAntes = await leerSnapshotCrudo(t.db, id);

      const segundo = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [{ ...consumoDe(esc), dosisAplicada: '99 ml/L', lote: 'OTRO-LOTE' }],
      });

      expect(segundo.status).toBe(409);
      expect(await leerSnapshotCrudo(t.db, id)).toBe(crudoAntes);
      expect((await leer(id)).body.versionSync).toBe(2);
    });

    itBug('BUG-01', 'la fecha de ejecución se devuelve en formato ISO (YYYY-MM-DD)', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const res = await leer(id);

      expect(res.status).toBe(200);
      expect(res.body.fechaEjecucion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // C. Guardas de la base de datos
  // ---------------------------------------------------------------------------------------------
  describe('C. La base de datos protege el histórico (defensa en profundidad)', () => {
    itBug('BUG-03', 'la BD rechaza un UPDATE directo de snapshot_catalogos sobre una inspección CERRADA', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);

      await expect(
        t.db.query(`UPDATE inspecciones SET snapshot_catalogos = '{"manipulado":true}'::jsonb WHERE id = $1`, [id]),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------------------------
  // D. Validaciones y errores HTTP (no dependen de defectos)
  // ---------------------------------------------------------------------------------------------
  describe('D. Validaciones y errores HTTP', () => {
    it('cerrar con un id que no es UUID responde 400', async () => {
      const res = await http.post('/operaciones/inspecciones/no-es-uuid/cerrar', {});
      expect(res.status).toBe(400);
    });

    it('cerrar una inspección inexistente responde 404', async () => {
      const res = await http.post(`/operaciones/inspecciones/${randomUUID()}/cerrar`, {});
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('no encontrada');
    });

    it('consultar una inspección inexistente responde 404', async () => {
      const res = await http.get(`/operaciones/inspecciones/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('rechaza un consumo con cantidad 0 o sin lote (400)', async () => {
      const id = randomUUID();
      const sinCantidad = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [{ insumoId: randomUUID(), dosisAplicada: '5 ml/L', lote: 'L-1', cantidadUtilizada: 0 }],
      });
      const sinLote = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [{ insumoId: randomUUID(), dosisAplicada: '5 ml/L', lote: '', cantidadUtilizada: 1 }],
      });
      expect(sinCantidad.status).toBe(400);
      expect(sinLote.status).toBe(400);
    });

    it('crear una inspección con servicioId que no es UUID responde 400', async () => {
      const res = await http.post('/operaciones/inspecciones', { servicioId: 'servicio-demo' });
      expect(res.status).toBe(400);
    });

    it('crear una inspección para un servicio que no existe responde 400 (FK) y no deja filas', async () => {
      const res = await http.post('/operaciones/inspecciones', { servicioId: randomUUID() });
      expect(res.status).toBe(400);
      const { rows } = await t.db.query('SELECT count(*)::int AS n FROM inspecciones');
      expect(rows[0].n).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // E. Pendientes de decisión del equipo
  // ---------------------------------------------------------------------------------------------
  describe('E. Pendientes (esperan decisión del equipo o funcionalidad nueva)', () => {
    it.todo('DECISIÓN-2a: cerrar con un insumo que NO existe en el catálogo (hoy se omite del snapshot sin avisar; recomendado: rechazar)');
    it.todo('DECISIÓN-2b: cerrar con un insumo INACTIVO (recomendado: aceptar y congelar, porque ya se aplicó en campo)');
    it.todo('SNAPSHOT-EQUIPOS-PERSONAL: design.md exige congelar equipos y personal; hoy solo se congelan insumos y no hay API para asignarlos');
    it.todo('BUG-05: cuando exista PATCH de insumos, editarInsumoEnCatalogo() debe usar la API en vez de SQL directo');
  });
});
