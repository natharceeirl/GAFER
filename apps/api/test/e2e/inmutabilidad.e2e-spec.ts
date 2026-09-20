/**
 * inmutabilidad.e2e-spec.ts
 * Pruebas de la regla de inmutabilidad
 *
 * Estas pruebas usan la aplicación real y una base PostgreSQL real (gafer_test).
 *
 * Grupos
 *   A. Una inspección cerrada no cambia cuando se editan los catálogos.
 *   B. Recorrido completo: crear la inspección, cerrarla y luego cambiar el catálogo.
 *   C. La base de datos protege por sí misma la inspección cerrada.
 *   D. Errores de validación (datos mal enviados, registros que no existen).
 *   E. Casos pendientes hasta que el equipo decida o exista la función.
 *
 * Las pruebas marcadas [BUG-xx] dependen de un error conocido (ver support/known-bugs.ts).
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación de la suite (25 casos).
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

// Datos nuevos que se usan para simular que un insumo fue editado
const CAMBIOS_REFORMULACION = {
  nombre_comercial: 'Cipermetrina 50% Ultra Concentrada (REFORMULADO 2028)',
  principio_activo: 'Cipermetrina Pura',
  registro_digesa: 'RD-9999-2028/DIGESA/SA',
  concentracion: '50% p/v',
  dosis_estandar: '2.5 ml/L',
};

describe('Sección 13: inmutabilidad de inspecciones cerradas', () => {
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

  // Funciones de ayuda
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

  /** Deja lista una inspección ya cerrada con datos conocidos. */
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

  // A. Una inspección cerrada no cambia cuando se editan los catálogos
  describe('A. La inspección cerrada no cambia al editar los catálogos', () => {
    // Se cambian el nombre, el registro y la dosis del insumo. La inspección debe seguir mostrando los valores de cuando se cerró.
    it('editar un insumo del catálogo no cambia la inspección cerrada', async () => {
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

    // Se da de baja el insumo. La inspección debe quedar igual.
    it('desactivar un insumo no cambia la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      const res = await http.patch(`/mantenimiento/insumos/${esc.insumoId}/desactivar`);
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('INACTIVO');

      expect((await leer(id)).body).toEqual(antes.body);
    });

    // Se borra el insumo. La inspección debe seguir mostrándose completa, porque guarda su propia copia.
    it('eliminar un insumo no cambia ni rompe la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      await eliminarInsumoDelCatalogo(t.db, esc.insumoId);

      const despues = await leer(id);
      expect(despues.status).toBe(200);
      expect(despues.body).toEqual(antes.body);
    });

    // Se cambia el nombre del cliente y se lo da de baja. La inspección debe quedar igual.
    it('renombrar o desactivar al cliente no cambia la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      const renombrado = await http.patch(`/mantenimiento/clientes/${esc.clienteId}`, { razonSocial: 'Otro Nombre S.A.C.' });
      expect(renombrado.status).toBe(200);
      const desactivado = await http.patch(`/mantenimiento/clientes/${esc.clienteId}/desactivar`);
      expect(desactivado.status).toBe(200);

      expect((await leer(id)).body).toEqual(antes.body);
    });

    // Se pone un equipo fuera de servicio y se da de baja a un técnico. La inspección debe quedar igual.
    it('cambiar el estado de un equipo o dar de baja a un técnico no cambia la inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);
      const antes = await leer(id);

      const equipo = await http.patch(`/mantenimiento/equipos/${esc.equipoId}/estado`, { estadoOperativo: 'FUERA_SERVICIO' });
      expect(equipo.status).toBe(200);
      const tecnico = await http.patch(`/mantenimiento/personal/${esc.tecnicoId}/desactivar`);
      expect(tecnico.status).toBe(200);

      expect((await leer(id)).body).toEqual(antes.body);
    });

    // Las dos formas de consultar la inspección deben dar los mismos datos, incluso después de editar el catálogo.
    it('consultar por identificador o por servicio devuelve la misma copia guardada', async () => {
      const esc = await crearEscenario(http);
      const { id, snapshot } = await sembrarCerrada(esc);
      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION);

      const porId = await leer(id);
      const porServicio = await http.get(`/operaciones/inspecciones?servicioId=${esc.servicioId}`);

      expect(porId.body.snapshotCatalogos).toEqual(snapshot);
      expect(porServicio.body.snapshotCatalogos).toEqual(snapshot);
    });

    // La base de datos debe impedir el borrado, para no perder el historial.
    it('no se puede borrar un servicio ni un cliente que ya tienen inspecciones', async () => {
      const esc = await crearEscenario(http);
      await sembrarCerrada(esc);

      await expect(t.db.query('DELETE FROM servicios_contratados WHERE id = $1', [esc.servicioId])).rejects.toMatchObject({
        code: '23503',
      });
      await expect(t.db.query('DELETE FROM clientes WHERE id = $1', [esc.clienteId])).rejects.toMatchObject({ code: '23503' });
    });
  });

  // B. Recorrido completo por la API
  describe('B. Recorrido completo: crear, cerrar y cambiar el catálogo', () => {
    // Se crea y se cierra una inspección. Debe quedar CERRADA con la copia de los datos del insumo.
    itBug('BUG-01', 'al cerrar, la inspección guarda una copia de los datos del insumo', async () => {
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

    // Se cierra la inspección y luego se edita el insumo. La copia guardada no debe cambiar en nada.
    itBug('BUG-01', 'editar el catálogo después de cerrar deja la copia guardada exactamente igual', async () => {
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

    // Se cierra la inspección y luego se da de baja y se borra el insumo. La copia no debe cambiar.
    itBug('BUG-01', 'desactivar o eliminar el insumo después de cerrar no cambia la copia', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);
      await http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] });
      const antes = await leer(id);
      expect(antes.body.snapshotCatalogos.insumos).toHaveLength(1);

      await http.patch(`/mantenimiento/insumos/${esc.insumoId}/desactivar`);
      await eliminarInsumoDelCatalogo(t.db, esc.insumoId);

      expect((await leer(id)).body).toEqual(antes.body);
    });

    // Se cierra una inspección, se cambia el insumo y se cierra otra. La primera conserva los datos viejos y la segunda los nuevos.
    itBug('BUG-01', 'cada inspección conserva los datos del momento en que se cerró', async () => {
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

    // Se crea el borrador, se cambia el insumo y recién se cierra. La copia debe tener el dato nuevo.
    itBug('BUG-01', 'la copia toma los datos del momento del cierre, no de cuando se creó el borrador', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc); // borrador con el insumo original
      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION); // cambia ANTES de cerrar

      const cierre = await http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] });

      expect(cierre.status).toBe(201);
      expect(cierre.body.snapshotCatalogos.insumos[0].nombreHistorico).toBe(CAMBIOS_REFORMULACION.nombre_comercial);
    });

    // Un segundo cierre debe responder 409 y no cambiar nada de lo guardado.
    itBug('BUG-01', 'una inspección cerrada no se puede volver a cerrar', async () => {
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

    // La fecha debe verse como 2026-09-20 y no como texto largo en inglés.
    itBug('BUG-01', 'la fecha de ejecución se muestra con formato AAAA-MM-DD', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const res = await leer(id);

      expect(res.status).toBe(200);
      expect(res.body.fechaEjecucion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // C. Protección desde la base de datos
  describe('C. La base de datos protege la inspección cerrada', () => {
    // Se intenta cambiar la copia directamente en la base. Debe rechazarlo.
    itBug('BUG-03', 'la base de datos no deja modificar la copia de una inspección cerrada', async () => {
      const esc = await crearEscenario(http);
      const { id } = await sembrarCerrada(esc);

      await expect(
        t.db.query(`UPDATE inspecciones SET snapshot_catalogos = '{"manipulado":true}'::jsonb WHERE id = $1`, [id]),
      ).rejects.toThrow();
    });
  });

  // D. Errores de validación
  describe('D. Errores de validación', () => {
    // Un identificador que no tiene el formato correcto debe rechazarse.
    it('cerrar con un identificador inválido responde 400', async () => {
      const res = await http.post('/operaciones/inspecciones/no-es-uuid/cerrar', {});
      expect(res.status).toBe(400);
    });

    // Se intenta cerrar una inspección que nadie creó.
    it('cerrar una inspección que no existe responde 404', async () => {
      const res = await http.post(`/operaciones/inspecciones/${randomUUID()}/cerrar`, {});
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('no encontrada');
    });

    // Se consulta una inspección que nadie creó.
    it('consultar una inspección que no existe responde 404', async () => {
      const res = await http.get(`/operaciones/inspecciones/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    // Al cerrar, la cantidad debe ser mayor que cero y el lote no puede ir vacío.
    it('rechaza un consumo con cantidad 0 o sin lote', async () => {
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

    // El servicio debe enviarse con identificador válido.
    it('crear una inspección con un servicio inválido responde 400', async () => {
      const res = await http.post('/operaciones/inspecciones', { servicioId: 'servicio-demo' });
      expect(res.status).toBe(400);
    });

    // No debe quedar ningún registro a medias.
    it('crear una inspección para un servicio que no existe responde 400 y no guarda nada', async () => {
      const res = await http.post('/operaciones/inspecciones', { servicioId: randomUUID() });
      expect(res.status).toBe(400);
      const { rows } = await t.db.query('SELECT count(*)::int AS n FROM inspecciones');
      expect(rows[0].n).toBe(0);
    });
  });

  // E. Pendientes
  describe('E. Pendientes (falta una decisión del equipo o una función nueva)', () => {
    it.todo('Cerrar con un insumo que no existe en el catálogo (hoy se ignora sin avisar; se propone rechazar)');
    it.todo('Cerrar con un insumo desactivado (se propone aceptarlo, porque ya se usó en campo)');
    it.todo('Guardar también equipos y personal en la copia de la inspección cerrada (hoy solo se guardan insumos)');
    it.todo('Cuando la API permita editar insumos, usarla en las pruebas en vez de la base directa');
  });
});
