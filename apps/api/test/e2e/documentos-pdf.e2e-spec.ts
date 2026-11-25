/**
 * documentos-pdf.e2e-spec.ts
 * Solicitud, descarga y datos del PDF del Informe de Servicio contra la aplicación real (GAF-54).
 * La cola y el almacenamiento van en memoria; la base es PostgreSQL real.
 */
import { createHash } from 'crypto';
import { createTestApp, TestApp } from '../support/app';
import { autorizacion, autorizacionDePersonal } from '../support/auth';
import { resetDb } from '../support/db';
import { api, Api, crearEscenario, Escenario } from '../support/fixtures';
import { GenerarPdfDocumentoUseCase } from '../../src/documentos/application/generar-pdf-documento.usecase';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../../src/documentos/domain/ports/documento.repository';
import { DOCUMENTO_PDF_DATOS, DocumentoPdfDatosPort, PdfRendererPort } from '../../src/documentos/domain/ports/pdf.ports';
import { TRANSACCION, TransaccionPort } from '../../src/documentos/domain/ports/transaccion.port';

/** PNG de 1x1 píxel: solo para pruebas; la aplicación nunca fabrica firmas. */
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
const PNG = Buffer.from(PNG_B64, 'base64');

describe('PDF del documento: API y datos (GAF-54, GAF-55)', () => {
  let t: TestApp;
  let http: Api;
  let esc: Escenario;
  let generar: GenerarPdfDocumentoUseCase;
  let datos: DocumentoPdfDatosPort;
  const renderer: PdfRendererPort = { renderizar: async (d) => Buffer.from(`%PDF-1.4\n% ${d.documento.codigo}\n`) };

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
    datos = t.app.get<DocumentoPdfDatosPort>(DOCUMENTO_PDF_DATOS);
    generar = new GenerarPdfDocumentoUseCase(
      t.app.get<DocumentoRepository>(DOCUMENTO_REPOSITORY),
      t.app.get<TransaccionPort>(TRANSACCION),
      datos,
      renderer,
      t.almacen,
    );
  });

  beforeEach(async () => {
    await resetDb(t.db);
    esc = await crearEscenario(http);
    t.cola.trabajos.length = 0;
    t.cola.fallar = null;
    t.almacen.vaciar();
  });

  afterAll(async () => {
    await t.close();
  });

  const supervisor = () => autorizacionDePersonal(t.db, 'SUPERVISOR', 'SUP.UNO');

  async function crearDocumento(): Promise<string> {
    const res = await http.post('/documentos', { clienteId: esc.clienteId, tipo: 'INFORME', proyectoId: esc.proyectoId }, await supervisor());
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function transicionar(id: string, nuevoEstado: string) {
    return http.post(`/documentos/${id}/transicion`, { nuevoEstado }, await supervisor());
  }

  async function aprobado(): Promise<string> {
    const id = await crearDocumento();
    for (const estado of ['CERRADO', 'ENVIADO_A_REVISION', 'APROBADO']) expect((await transicionar(id, estado)).status).toBe(201);
    return id;
  }

  describe('aprobar encola el PDF', () => {
    it('pasar a APROBADO por HTTP encola un trabajo y deja el PDF en PENDIENTE', async () => {
      const id = await crearDocumento();
      await transicionar(id, 'CERRADO');
      await transicionar(id, 'ENVIADO_A_REVISION');
      expect(t.cola.trabajos).toHaveLength(0);
      await transicionar(id, 'APROBADO');
      expect(t.cola.trabajos).toEqual([id]);
      const detalle = await http.get(`/documentos/${id}`, autorizacion('SUPERVISOR'));
      expect(detalle.body.pdf).toEqual({ estado: 'PENDIENTE', generadoAt: null, error: null, sha256: null });
    });

    it('si Redis está caído la aprobación responde 201 y el error del PDF queda visible', async () => {
      const id = await crearDocumento();
      await transicionar(id, 'CERRADO');
      await transicionar(id, 'ENVIADO_A_REVISION');
      t.cola.fallar = new Error('Redis no responde');
      const res = await transicionar(id, 'APROBADO');
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('APROBADO');
      const detalle = await http.get(`/documentos/${id}`, autorizacion('SUPERVISOR'));
      expect(detalle.body.pdf).toMatchObject({ estado: 'ERROR', error: expect.stringContaining('Redis no responde') });
    });
  });

  describe('POST /documentos/:id/pdf', () => {
    it('Administrador y Supervisor reintentan la generación (202) y se encola de nuevo', async () => {
      const id = await aprobado();
      t.cola.trabajos.length = 0;
      const a = await http.post(`/documentos/${id}/pdf`, {}, await autorizacionDePersonal(t.db, 'ADMINISTRADOR', 'ADM.UNO'));
      const b = await http.post(`/documentos/${id}/pdf`, {}, await supervisor());
      expect(a.status).toBe(202);
      expect(a.body).toEqual({ id, pdfEstado: 'PENDIENTE' });
      expect(b.status).toBe(202);
      expect(t.cola.trabajos).toEqual([id, id]);
      const eventos = await t.db.query(`SELECT actor_usuario FROM auditoria_eventos WHERE entidad_id = $1 AND accion = 'GENERAR_PDF' ORDER BY created_at`, [id]);
      expect(eventos.rows.map((r) => r.actor_usuario)).toEqual(['ADM.UNO', 'SUP.UNO']);
    });

    it('el Técnico no entra (403)', async () => {
      const id = await aprobado();
      const res = await http.post(`/documentos/${id}/pdf`, {}, autorizacion('TECNICO_OPERADOR'));
      expect(res.status).toBe(403);
    });

    it('un documento que no está aprobado responde 409 y no encola', async () => {
      const id = await crearDocumento();
      const res = await http.post(`/documentos/${id}/pdf`, {}, await supervisor());
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Solo se puede generar el PDF de un documento aprobado');
      expect(t.cola.trabajos).toHaveLength(0);
    });

    it('un documento inexistente responde 404 y un id mal formado 400', async () => {
      expect((await http.post('/documentos/3f0f1c0e-5d7a-4a5e-9b6f-0d6a3c1d2e4f/pdf', {}, await supervisor())).status).toBe(404);
      expect((await http.post('/documentos/no-es-uuid/pdf', {}, await supervisor())).status).toBe(400);
    });

    it('con la cola caída responde 503 con el motivo, y el documento queda en ERROR', async () => {
      const id = await aprobado();
      t.cola.fallar = new Error('Redis no responde');
      const res = await http.post(`/documentos/${id}/pdf`, {}, await supervisor());
      expect(res.status).toBe(503);
      expect(res.body.message).toContain('Redis no responde');
      const detalle = await http.get(`/documentos/${id}`, autorizacion('SUPERVISOR'));
      expect(detalle.body.pdf.estado).toBe('ERROR');
    });
  });

  describe('GET /documentos/:id/pdf', () => {
    it('409 mientras no esté generado y 404 si el documento no existe', async () => {
      const id = await aprobado();
      const res = await http.get(`/documentos/${id}/pdf`, await supervisor());
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('todavía no está generado');
      expect((await http.get('/documentos/3f0f1c0e-5d7a-4a5e-9b6f-0d6a3c1d2e4f/pdf', await supervisor())).status).toBe(404);
    });

    it('con el PDF generado lo entrega como application/pdf con su código en el nombre', async () => {
      const id = await aprobado();
      await generar.ejecutar(id);
      const res = await http.get(`/documentos/${id}/pdf`, await supervisor()).buffer(true).parse(binario);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      const detalle = await http.get(`/documentos/${id}`, autorizacion('SUPERVISOR'));
      expect(res.headers['content-disposition']).toContain(`${detalle.body.codigo}.pdf`);
      expect((res.body as Buffer).toString()).toContain(`% ${detalle.body.codigo}`);
      expect(detalle.body.pdf).toMatchObject({ estado: 'GENERADO', error: null, generadoAt: expect.any(String) });
    });

    it('expone la huella SHA-256 en el detalle y coincide con los bytes entregados (GAF-56)', async () => {
      const id = await aprobado();
      expect((await http.get(`/documentos/${id}`, autorizacion('SUPERVISOR'))).body.pdf.sha256).toBeNull();
      await generar.ejecutar(id);
      const res = await http.get(`/documentos/${id}/pdf`, await supervisor()).buffer(true).parse(binario);
      const detalle = await http.get(`/documentos/${id}`, autorizacion('SUPERVISOR'));
      expect(detalle.body.pdf.sha256).toBe(createHash('sha256').update(res.body as Buffer).digest('hex'));
    });

    it('si los bytes guardados no coinciden con la huella responde 500 claro, no entrega el archivo y deja evento de auditoria (GAF-56)', async () => {
      const id = await aprobado();
      await generar.ejecutar(id);
      const { rows } = await t.db.query(`SELECT pdf_storage_key FROM documentos WHERE id = $1`, [id]);
      await t.almacen.guardar(rows[0].pdf_storage_key, Buffer.from('%PDF-1.4\n% adulterado\n'));

      const res = await http.get(`/documentos/${id}/pdf`, await supervisor());
      expect(res.status).toBe(500);
      expect(res.body.message).toContain('no coincide con su huella SHA-256');

      const eventos = await t.db.query(`SELECT modulo, accion, entidad_id FROM auditoria_eventos WHERE accion = 'PDF_INTEGRIDAD_FALLIDA'`);
      expect(eventos.rows).toEqual([{ modulo: 'DOCUMENTOS', accion: 'PDF_INTEGRIDAD_FALLIDA', entidad_id: id }]);
    });

    it('un PDF ya generado no se puede volver a pedir: 409 y la cola no recibe nada (GAF-56)', async () => {
      const id = await aprobado();
      await generar.ejecutar(id);
      t.cola.trabajos.length = 0;
      const res = await http.post(`/documentos/${id}/pdf`, {}, await supervisor());
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('ya fue emitido');
      expect(t.cola.trabajos).toHaveLength(0);
      expect((await http.get(`/documentos/${id}`, autorizacion('SUPERVISOR'))).body.pdf.estado).toBe('GENERADO');
    });

    it('el Técnico no descarga (403)', async () => {
      const id = await aprobado();
      expect((await http.get(`/documentos/${id}/pdf`, autorizacion('TECNICO_OPERADOR'))).status).toBe(403);
    });
  });

  describe('datos del PDF desde PostgreSQL', () => {
    it('reúne documento, cliente, sede, servicio con insumos, director y quien aprobó', async () => {
      await http.patch('/mantenimiento/servicios-contratados/' + esc.servicioId, { insumosAutorizados: [esc.insumoId], equiposAutorizados: [esc.equipoId] });
      const id = await aprobado();
      const d = (await datos.cargar(id))!;

      expect(d.documento).toMatchObject({ id, tipo: 'INFORME', numeroCorrelativo: 1, estado: 'APROBADO' });
      expect(d.documento.codigo).toMatch(/^INFORME-QA\d{3}-001-\d{4}$/);
      expect(d.cliente).toMatchObject({ ruc: expect.stringMatching(/^20\d{9}$/), giroNegocio: 'Generación Eléctrica' });
      expect(d.sede).toMatchObject({ distrito: 'Mollendo', departamento: 'Arequipa' });
      expect(d.director).toEqual({ nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: null });
      expect(d.aprobacion).toEqual({ usuario: 'SUP.UNO', nombre: 'Usuario De Prueba', cargo: 'SUPERVISOR', fecha: expect.any(String) });
      expect(new Date(d.aprobacion!.fecha).getTime()).toBeGreaterThan(Date.now() - 60_000);
      expect(d.firmaCliente).toBeNull();
      expect(d.servicios).toHaveLength(1);
      expect(d.servicios[0]).toMatchObject({ tipoServicio: 'DRT', areaTotalM2: 5000, areaTratarM2: 3500 });
      expect(d.servicios[0].insumos[0]).toMatchObject({
        producto: esc.insumoOriginal.nombreComercial,
        registroDigesa: esc.insumoOriginal.registroDigesa,
        concentracion: esc.insumoOriginal.concentracion,
      });
      expect(d.servicios[0].equipos).toHaveLength(1);
      expect(d.fotos).toEqual([]);
    });

    describe('firmas (GAF-55)', () => {
      it('el Director Técnico: la firma configurada en Mantenimiento (data URL) llega como imagen', async () => {
        await t.db.query(`UPDATE configuracion_sistema SET director_firma = $1 WHERE id = 'global'`, [`data:image/png;base64,${PNG_B64}`]);
        const id = await aprobado();
        expect((await datos.cargar(id))!.director.firma).toEqual(PNG);
      });

      it('el Director Técnico: una clave de almacenamiento se lee del almacén; si no existe o no es imagen, no hay firma', async () => {
        const id = await aprobado();
        await t.db.query(`UPDATE configuracion_sistema SET director_firma = 'firmas/director.png' WHERE id = 'global'`);
        expect((await datos.cargar(id))!.director.firma).toBeNull();
        await t.almacen.guardar('firmas/director.png', Buffer.from('%PDF-no-es-imagen'));
        expect((await datos.cargar(id))!.director.firma).toBeNull();
        await t.almacen.guardar('firmas/director.png', PNG);
        expect((await datos.cargar(id))!.director.firma).toEqual(PNG);
      });

      it('el cliente: la firma del responsable guardada en el documento llega como imagen; vacía = no disponible', async () => {
        const id = await aprobado();
        expect((await datos.cargar(id))!.firmaCliente).toBeNull();
        await t.db.query(`UPDATE documentos SET firma_cliente = $2 WHERE id = $1`, [id, `data:image/png;base64,${PNG_B64}`]);
        expect((await datos.cargar(id))!.firmaCliente).toEqual(PNG);
        await t.db.query(`UPDATE documentos SET firma_cliente = 'texto-basura' WHERE id = $1`, [id]);
        expect((await datos.cargar(id))!.firmaCliente).toBeNull();
      });

      it('si el documento no tiene aprobación registrada, aprobacion es null (no se inventa aprobador)', async () => {
        const id = await crearDocumento();
        expect((await datos.cargar(id))!.aprobacion).toBeNull();
      });
    });

    it('sin datos de empresa configurados llegan nulos (no se inventan) y con ellos se usan tal cual', async () => {
      const id = await aprobado();
      expect((await datos.cargar(id))!.empresa).toEqual({ razonSocial: null, ruc: null, direccion: null, telefono: null });

      await t.db.query(
        `UPDATE configuracion_sistema SET parametros = $1::jsonb WHERE id = 'global'`,
        [JSON.stringify({ empresa: { razonSocial: 'GAFER DEMO S.A.C.', ruc: '20000000001', direccion: 'Calle Demo 1', telefono: '999000111' } })],
      );
      expect((await datos.cargar(id))!.empresa).toEqual({
        razonSocial: 'GAFER DEMO S.A.C.',
        ruc: '20000000001',
        direccion: 'Calle Demo 1',
        telefono: '999000111',
      });
    });

    it('un documento inexistente devuelve null', async () => {
      expect(await datos.cargar('3f0f1c0e-5d7a-4a5e-9b6f-0d6a3c1d2e4f')).toBeNull();
    });
  });
});

function binario(res: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void): void {
  const partes: Buffer[] = [];
  res.on('data', (p: Buffer) => partes.push(p));
  res.on('end', () => cb(null, Buffer.concat(partes)));
}
