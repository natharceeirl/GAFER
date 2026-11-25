/**
 * documentos-pdf-repositorio.e2e-spec.ts
 * Migración 006 y persistencia del estado del PDF contra PostgreSQL real (GAF-54).
 */
import { randomUUID } from 'crypto';
import { createTestApp, TestApp } from '../support/app';
import { resetDb } from '../support/db';
import { leerMigraciones } from '../../src/database/migrator';
import { CrearDocumentoUseCase } from '../../src/documentos/application/crear-documento.usecase';
import { TransicionarDocumentoUseCase } from '../../src/documentos/application/transicionar-documento.usecase';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../../src/documentos/domain/ports/documento.repository';

const ACTOR = { id: randomUUID(), usuario: 'SUP.E2E', rol: 'SUPERVISOR' };

describe('Estado del PDF en PostgreSQL (GAF-54)', () => {
  let t: TestApp;
  let repo: DocumentoRepository;
  let crear: CrearDocumentoUseCase;
  let transicionar: TransicionarDocumentoUseCase;
  let clienteId: string;

  beforeAll(async () => {
    t = await createTestApp();
    repo = t.app.get<DocumentoRepository>(DOCUMENTO_REPOSITORY);
    crear = t.app.get(CrearDocumentoUseCase);
    transicionar = t.app.get(TransicionarDocumentoUseCase);
  });

  beforeEach(async () => {
    await resetDb(t.db);
    const res = await t.db.query(
      `INSERT INTO clientes (razon_social, ruc, codigo_corto, direccion_fiscal, giro_negocio,
                             contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo)
       VALUES ('Cliente Demo S.A.', '20123456789', 'DEMO', 'Av. 1', 'Energía', 'Ana', 'Jefa', '999', 'a@example.com') RETURNING id`,
    );
    clienteId = res.rows[0].id;
  });

  afterAll(async () => {
    await t.close();
  });

  async function aprobado() {
    const doc = await crear.ejecutar(clienteId, 'INFORME', ACTOR);
    for (const estado of ['CERRADO', 'ENVIADO_A_REVISION', 'APROBADO'] as const) await transicionar.ejecutar(doc.id, estado, ACTOR);
    return doc.id;
  }

  describe('migración 006', () => {
    it('se puede aplicar varias veces seguidas y deja las columnas del PDF', async () => {
      const migraciones = await leerMigraciones('up');
      expect(migraciones.map((m) => m.nombre)).toContain('006_documento_pdf.up.sql');
      for (let vuelta = 0; vuelta < 3; vuelta++) for (const m of migraciones) await t.db.query(m.sql);
      const cols = await t.db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'documentos' AND column_name LIKE 'pdf_%' ORDER BY 1`,
      );
      expect(cols.rows.map((r) => r.column_name)).toEqual(['pdf_error', 'pdf_estado', 'pdf_generado_at', 'pdf_intentos', 'pdf_storage_key']);
    });

    it('la reversa se aplica dos veces y se puede volver a subir', async () => {
      const abajo = (await leerMigraciones('down')).find((m) => m.nombre === '006_documento_pdf.down.sql')!;
      const arriba = (await leerMigraciones('up')).find((m) => m.nombre === '006_documento_pdf.up.sql')!;
      await t.db.query(abajo.sql);
      await t.db.query(abajo.sql);
      const sin = await t.db.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'documentos' AND column_name = 'pdf_estado'`);
      expect(sin.rows).toHaveLength(0);
      await t.db.query(arriba.sql);
      const con = await t.db.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'documentos' AND column_name = 'pdf_estado'`);
      expect(con.rows).toHaveLength(1);
    });

    it('la base rechaza un estado de PDF desconocido', async () => {
      const id = await aprobado();
      await expect(t.db.query(`UPDATE documentos SET pdf_estado = 'RARO' WHERE id = $1`, [id])).rejects.toThrow();
    });
  });

  it('guarda y lee el estado del PDF con clave, fecha, error e intentos', async () => {
    const id = await aprobado();
    expect((await repo.buscarPorId(id))!.getPdf().estado).toBeNull();

    const doc = (await repo.buscarPorId(id))!;
    doc.solicitarPdf();
    doc.iniciarGeneracionPdf();
    doc.marcarPdfFallido('MinIO no responde');
    await repo.guardar(doc);
    expect((await repo.buscarPorId(id))!.getPdf()).toMatchObject({ estado: 'ERROR', error: 'MinIO no responde', intentos: 1, storageKey: null });

    const reintento = (await repo.buscarPorId(id))!;
    reintento.iniciarGeneracionPdf();
    const fecha = new Date('2026-11-24T15:00:00.000Z');
    reintento.marcarPdfGenerado(`documentos/${id}/x.pdf`, fecha);
    await repo.guardar(reintento);
    expect((await repo.buscarPorId(id))!.getPdf()).toEqual({
      estado: 'GENERADO',
      storageKey: `documentos/${id}/x.pdf`,
      generadoAt: fecha,
      error: null,
      intentos: 2,
    });
  });

  it('el detalle expone el estado del PDF', async () => {
    const id = await aprobado();
    const doc = (await repo.buscarPorId(id))!;
    doc.solicitarPdf();
    await repo.guardar(doc);
    const detalle = await repo.obtenerDetalle(id);
    expect(detalle!.pdf).toEqual({ estado: 'PENDIENTE', generadoAt: null, error: null });
  });
});
