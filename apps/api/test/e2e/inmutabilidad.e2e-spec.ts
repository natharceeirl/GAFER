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
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación de la suite (25 casos).
 *   v1.1  2026-09-23  ahilacondo  Se quitan las marcas de error: BUG-01 y BUG-03 ya fueron corregidos.
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
    it('al cerrar, la inspección guarda una copia de los datos del insumo', async () => {
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
    it('editar el catálogo después de cerrar deja la copia guardada exactamente igual', async () => {
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
    it('desactivar o eliminar el insumo después de cerrar no cambia la copia', async () => {
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
    it('cada inspección conserva los datos del momento en que se cerró', async () => {
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
    it('la copia toma los datos del momento del cierre, no de cuando se creó el borrador', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc); // borrador con el insumo original
      await editarInsumoEnCatalogo(t.db, esc.insumoId, CAMBIOS_REFORMULACION); // cambia ANTES de cerrar

      const cierre = await http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] });

      expect(cierre.status).toBe(201);
      expect(cierre.body.snapshotCatalogos.insumos[0].nombreHistorico).toBe(CAMBIOS_REFORMULACION.nombre_comercial);
    });

    // Un segundo cierre debe responder 409 y no cambiar nada de lo guardado.
    it('una inspección cerrada no se puede volver a cerrar', async () => {
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
    it('la fecha de ejecución se muestra con formato AAAA-MM-DD', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const res = await leer(id);

      expect(res.status).toBe(200);
      expect(res.body.fechaEjecucion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    // Cierres simultáneos en paralelo: exactamente uno debe responder 201 y los demás 409
    it('cierres simultáneos en paralelo solo permiten exactamente una respuesta 201 y el resto 409', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const promesas = Array.from({ length: 25 }, () =>
        http.post(`/operaciones/inspecciones/${id}/cerrar`, { consumos: [consumoDe(esc)] }),
      );
      const respuestas = await Promise.all(promesas);

      const exitosos = respuestas.filter((r) => r.status === 201);
      const conflictos = respuestas.filter((r) => r.status === 409);

      expect(exitosos).toHaveLength(1);
      expect(conflictos).toHaveLength(24);
      const fila = await leerFilaInspeccion(t.db, id);
      expect(fila.estado).toBe('CERRADO');
      expect(fila.version_sync).toBe(2);
    });

    // Crear inspección sobre el mismo servicio reutiliza el borrador existente y no duplica filas (BUG-06)
    it('dos creaciones de inspección para el mismo servicio devuelven el mismo borrador sin duplicar filas (BUG-06)', async () => {
      const esc = await crearEscenario(http);
      const res1 = await http.post('/operaciones/inspecciones', { servicioId: esc.servicioId });
      const res2 = await http.post('/operaciones/inspecciones', { servicioId: esc.servicioId });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.id).toBe(res2.body.id);

      const { rows } = await t.db.query(
        'SELECT count(*)::int AS total FROM inspecciones WHERE servicio_id = $1 AND estado = $2',
        [esc.servicioId, 'BORRADOR'],
      );
      expect(rows[0].total).toBe(1);
    });
  });

  // C. Protección desde la base de datos
  describe('C. La base de datos protege la inspección cerrada', () => {
    // Se intenta cambiar la copia directamente en la base. Debe rechazarlo.
    it('la base de datos no deja modificar la copia de una inspección cerrada', async () => {
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

    // Cerrar con un insumo que no existe en el catálogo debe responder 400 y no cerrar la inspección (BUG-04)
    it('cerrar con un insumo inexistente en catálogo responde 400 y mantiene la inspección en borrador', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);
      const res = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [
          {
            insumoId: randomUUID(),
            dosisAplicada: '10 ml/L',
            lote: 'L-FANTASMA',
            cantidadUtilizada: 1.5,
          },
        ],
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no existe en el catálogo');
      const insp = await leer(id);
      expect(insp.body.estado).toBe('BORRADOR');
    });

    // Cerrar con un insumo desactivado se permite porque ya fue aplicado en campo
    it('cerrar con un insumo desactivado se permite y congela sus datos en el snapshot', async () => {
      const esc = await crearEscenario(http);
      await http.patch(`/mantenimiento/insumos/${esc.insumoId}/desactivar`);
      const id = await crearInspeccion(esc);
      const res = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [consumoDe(esc)],
      });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('CERRADO');
      expect(res.body.snapshotCatalogos.insumos).toHaveLength(1);
    });

    // Editar un insumo vía PATCH /mantenimiento/insumos/:id (GAP-01)
    it('editar un insumo vía PATCH /mantenimiento/insumos/:id actualiza el catálogo y no altera inspecciones cerradas (GAP-01)', async () => {
      const esc = await crearEscenario(http);
      const { id, snapshot } = await sembrarCerrada(esc);

      const res = await http.patch(`/mantenimiento/insumos/${esc.insumoId}`, {
        nombreComercial: 'Cipermetrina 50% Reformulada',
        concentracion: '50% p/v',
        dosisEstandar: '2.5 ml/L',
      });

      expect(res.status).toBe(200);
      expect(res.body.nombreComercial).toBe('Cipermetrina 50% Reformulada');
      expect(res.body.concentracion).toBe('50% p/v');

      const insp = await leer(id);
      expect(insp.body.snapshotCatalogos).toEqual(snapshot);
    });
  });

  // E. Brechas resueltas (GAP-04)
  describe('E. Brechas resueltas: Equipos y Personal en Snapshot (GAP-04)', () => {
    it('guardar también equipos y personal en la copia de la inspección cerrada y proteger su inmutabilidad (GAP-04)', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const cierre = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [consumoDe(esc)],
        equiposIds: [esc.equipoId],
        personalIds: [esc.tecnicoId],
      });

      expect(cierre.status).toBe(201);
      expect(cierre.body.estado).toBe('CERRADO');
      expect(cierre.body.snapshotCatalogos.insumos).toHaveLength(1);
      expect(cierre.body.snapshotCatalogos.equipos).toHaveLength(1);
      expect(cierre.body.snapshotCatalogos.equipos[0]).toMatchObject({
        equipoId: esc.equipoId,
        nombre: 'Nebulizadora ULV Vector Fog C-150',
        tipo: 'NEBULIZACION',
        estadoOperativo: 'OPERATIVO',
      });
      expect(cierre.body.snapshotCatalogos.personal).toHaveLength(1);
      expect(cierre.body.snapshotCatalogos.personal[0]).toMatchObject({
        personalId: esc.tecnicoId,
        nombreCompleto: 'Juan Perez Gomez',
        cargo: 'TECNICO_OPERADOR',
      });
      expect(cierre.body.tecnicosParticipantes).toEqual([
        { id: esc.tecnicoId, nombre: 'Juan Perez Gomez' },
      ]);

      // Modificamos el catálogo de equipos y damos de baja al técnico
      const equipoModificado = await http.patch(`/mantenimiento/equipos/${esc.equipoId}/estado`, {
        estadoOperativo: 'FUERA_SERVICIO',
      });
      expect(equipoModificado.status).toBe(200);

      const personalDesactivado = await http.patch(`/mantenimiento/personal/${esc.tecnicoId}/desactivar`);
      expect(personalDesactivado.status).toBe(200);

      // Verificamos que la inspección cerrada sigue mostrando los datos originales congelados
      const insp = await leer(id);
      expect(insp.status).toBe(200);
      expect(insp.body.snapshotCatalogos.equipos[0].estadoOperativo).toBe('OPERATIVO');
      expect(insp.body.snapshotCatalogos.personal[0].nombreCompleto).toBe('Juan Perez Gomez');
      expect(insp.body.snapshotCatalogos.personal[0].cargo).toBe('TECNICO_OPERADOR');
    });

    it('cerrar con un equipo inexistente en catálogo responde 400 y mantiene la inspección en borrador', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const res = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [consumoDe(esc)],
        equiposIds: [randomUUID()],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no existe en el catálogo');
      const insp = await leer(id);
      expect(insp.body.estado).toBe('BORRADOR');
    });

    it('cerrar con personal inexistente en catálogo responde 400 y mantiene la inspección en borrador', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const res = await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [consumoDe(esc)],
        personalIds: [randomUUID()],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no existe en el catálogo');
      const insp = await leer(id);
      expect(insp.body.estado).toBe('BORRADOR');
    });
  });

  // F. Brechas resueltas: Persistencia de Auditoría (GAP-03)
  describe('F. Brechas resueltas: Persistencia de Auditoría (GAP-03)', () => {
    it('persistir evento de creación y cierre en inspecciones_auditoria con técnico verificado (GAP-03)', async () => {
      const esc = await crearEscenario(http);

      // 1. Crear inspección con técnico en header x-actor
      const creacion = await http.post(
        '/operaciones/inspecciones',
        { servicioId: esc.servicioId },
        { 'x-actor': esc.tecnicoId },
      );
      expect(creacion.status).toBe(201);
      const id = creacion.body.id;

      // 2. Cerrar inspección
      const cierre = await http.post(
        `/operaciones/inspecciones/${id}/cerrar`,
        {
          consumos: [consumoDe(esc)],
          equiposIds: [esc.equipoId],
          personalIds: [esc.tecnicoId],
        },
        { 'x-actor': esc.tecnicoId },
      );
      expect(cierre.status).toBe(201);

      // 3. Consultar la bitácora de auditoría directamente en la base de datos
      const { rows: eventosBd } = await t.db.query(
        'SELECT inspeccion_id, actor_id, accion, server_received_at FROM inspecciones_auditoria WHERE inspeccion_id = $1 ORDER BY server_received_at ASC',
        [id],
      );

      expect(eventosBd.length).toBeGreaterThanOrEqual(2);
      expect(eventosBd[0]).toMatchObject({
        inspeccion_id: id,
        actor_id: esc.tecnicoId,
        accion: 'CREACION',
      });
      expect(eventosBd[1]).toMatchObject({
        inspeccion_id: id,
        actor_id: esc.tecnicoId,
        accion: 'CIERRE',
      });

      // 4. Consultar también a través del endpoint GET /operaciones/inspecciones/:id/auditoria
      const apiAuditoria = await http.get(`/operaciones/inspecciones/${id}/auditoria`);
      expect(apiAuditoria.status).toBe(200);
      expect(apiAuditoria.body.length).toBeGreaterThanOrEqual(2);
      expect(apiAuditoria.body[0].actor_id).toBe(esc.tecnicoId);
    });

    it('rechaza una operación con x-actor que no corresponde a un técnico registrado (GAP-03)', async () => {
      const esc = await crearEscenario(http);

      const res = await http.post(
        '/operaciones/inspecciones',
        { servicioId: esc.servicioId },
        { 'x-actor': 'tecnico-fantasma' },
      );

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no corresponde a un personal técnico registrado');
    });
  });

  // G. Brechas resueltas: Sincronización de Campo y Resolución de Colisiones (GAP-02)
  describe('G. Brechas resueltas: Sincronización de Campo (GAP-02)', () => {
    it('dos técnicos sincronizan estaciones distintas en paralelo y ambas cargas se conservan (GAP-02)', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      // Crear segundo técnico
      const tec2Res = await http.post('/mantenimiento/personal', {
        dni: '87654321',
        nombres: 'Roberto',
        apellidos: 'Gomez',
        cargo: 'TECNICO_OPERADOR',
        telefono: '999888777',
        usuario: 'RGOMEZ',
      });
      expect(tec2Res.status).toBe(201);
      const tec2Id = tec2Res.body.id;

      // Técnico 1 carga estaciones 1 y 2
      const op1Id = randomUUID();
      const op2Id = randomUUID();
      const syncTec1 = await http.post(`/operaciones/inspecciones/${id}/sincronizar`, {
        operaciones: [
          {
            operationId: op1Id,
            tipo: 'REGISTRO_ESTACION',
            agregadoId: id,
            actorId: esc.tecnicoId,
            clienteTimestamp: new Date().toISOString(),
            payload: { numeroEstacion: 1, huboConsumo: false, colorAura: 'VERDE' },
          },
          {
            operationId: op2Id,
            tipo: 'REGISTRO_ESTACION',
            agregadoId: id,
            actorId: esc.tecnicoId,
            clienteTimestamp: new Date().toISOString(),
            payload: { numeroEstacion: 2, huboConsumo: true, colorAura: 'AMARILLO' },
          },
        ],
      });
      expect(syncTec1.status).toBe(201);
      expect(syncTec1.body.procesadas).toEqual([op1Id, op2Id]);

      // Técnico 2 carga estaciones 51 y 52
      const op3Id = randomUUID();
      const op4Id = randomUUID();
      const syncTec2 = await http.post(`/operaciones/inspecciones/${id}/sincronizar`, {
        operaciones: [
          {
            operationId: op3Id,
            tipo: 'REGISTRO_ESTACION',
            agregadoId: id,
            actorId: tec2Id,
            clienteTimestamp: new Date().toISOString(),
            payload: { numeroEstacion: 51, huboConsumo: false, colorAura: 'VERDE' },
          },
          {
            operationId: op4Id,
            tipo: 'REGISTRO_ESTACION',
            agregadoId: id,
            actorId: tec2Id,
            clienteTimestamp: new Date().toISOString(),
            payload: { numeroEstacion: 52, huboConsumo: true, colorAura: 'ROJO' },
          },
        ],
      });
      expect(syncTec2.status).toBe(201);
      expect(syncTec2.body.procesadas).toEqual([op3Id, op4Id]);

      // Verificar que las 4 operaciones quedaron persistidas en la bitácora de auditoría
      const { rows } = await t.db.query(
        'SELECT count(*)::int AS n FROM inspecciones_auditoria WHERE inspeccion_id = $1 AND accion = $2',
        [id, 'REGISTRO_ESTACION'],
      );
      expect(rows[0].n).toBe(4);
    });

    it('dos técnicos modifican la misma estación: prevalece el cambio más reciente y el desplazado se archiva (GAP-02)', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      const opAId = randomUUID();
      await http.post(`/operaciones/inspecciones/${id}/sincronizar`, {
        operaciones: [
          {
            operationId: opAId,
            tipo: 'REGISTRO_ESTACION',
            agregadoId: id,
            actorId: esc.tecnicoId,
            clienteTimestamp: '2026-09-20T10:00:00.000Z',
            payload: { numeroEstacion: 10, huboConsumo: false, colorAura: 'VERDE' },
          },
        ],
      });

      // Técnico B envía actualización para la misma estación 10
      const opBId = randomUUID();
      const syncColision = await http.post(`/operaciones/inspecciones/${id}/sincronizar`, {
        operaciones: [
          {
            operationId: opBId,
            tipo: 'ACTUALIZACION_ESTACION',
            agregadoId: id,
            actorId: esc.tecnicoId,
            clienteTimestamp: '2026-09-20T10:05:00.000Z',
            payload: { numeroEstacion: 10, huboConsumo: true, colorAura: 'ROJO' },
          },
        ],
      });

      expect(syncColision.status).toBe(201);
      expect(syncColision.body.procesadas).toContain(opBId);
      expect(syncColision.body.conflictos).toHaveLength(1);
      expect(syncColision.body.conflictos[0].operationId).toBe(opBId);
      expect(syncColision.body.conflictos[0].valorDesplazado).toMatchObject({
        numeroEstacion: 10,
        colorAura: 'VERDE',
      });
    });

    it('re-enviar una operación con el mismo operationId se procesa de forma idempotente (GAP-02)', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);
      const opId = randomUUID();

      const operacion = {
        operationId: opId,
        tipo: 'REGISTRO_ESTACION',
        agregadoId: id,
        actorId: esc.tecnicoId,
        clienteTimestamp: new Date().toISOString(),
        payload: { numeroEstacion: 7, huboConsumo: false },
      };

      const primera = await http.post(`/operaciones/inspecciones/${id}/sincronizar`, {
        operaciones: [operacion],
      });
      expect(primera.status).toBe(201);
      expect(primera.body.procesadas).toContain(opId);

      const segunda = await http.post(`/operaciones/inspecciones/${id}/sincronizar`, {
        operaciones: [operacion],
      });
      expect(segunda.status).toBe(201);
      expect(segunda.body.omitidasIdempotentes).toContain(opId);
      expect(segunda.body.procesadas).toHaveLength(0);
    });

    it('tras el cierre de inspección, cualquier intento de sincronización se rechaza con 409 (GAP-02)', async () => {
      const esc = await crearEscenario(http);
      const id = await crearInspeccion(esc);

      await http.post(`/operaciones/inspecciones/${id}/cerrar`, {
        consumos: [consumoDe(esc)],
        equiposIds: [esc.equipoId],
        personalIds: [esc.tecnicoId],
      });

      const res = await http.post(`/operaciones/inspecciones/${id}/sincronizar`, {
        operaciones: [
          {
            operationId: randomUUID(),
            tipo: 'REGISTRO_ESTACION',
            agregadoId: id,
            actorId: esc.tecnicoId,
            clienteTimestamp: new Date().toISOString(),
            payload: { numeroEstacion: 1 },
          },
        ],
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('cerrada y no acepta más sincronizaciones');
    });
  });
});
