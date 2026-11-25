/**
 * Integración de punta a punta del PDF (GAF-54): aprobar un documento -> trabajo en Redis -> worker ->
 * PDF en MinIO y estado en PostgreSQL. Necesita infraestructura real, así que solo corre si están
 * definidas REDIS_URL, DATABASE_URL y MINIO_ENDPOINT (ver el script de verificación del PR); sin ellas
 * Jest la muestra como omitida.
 *
 *   REDIS_URL=redis://localhost:56379 MINIO_ENDPOINT=http://localhost:59000 \
 *   DATABASE_URL=postgresql://gafer:gafer@localhost:55445/gafer_test pnpm --filter @gafer/worker test
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
import { createHash } from 'crypto';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import {
  ColaPdfBullmq,
  CrearDocumentoUseCase,
  DatosInformePdf,
  DOCUMENTO_REPOSITORY,
  PDF_RENDERER,
  S3StorageService,
  TransicionarDocumentoUseCase,
} from '@gafer/api';
import { WorkerModule } from '../worker.module';
import { PdfkitInformeRenderer } from '../pdf/pdfkit-informe.renderer';
import { GenerarPdfConsumer } from './generar-pdf.consumer';

const hayInfraestructura = Boolean(process.env.REDIS_URL && process.env.DATABASE_URL && process.env.MINIO_ENDPOINT);
const describeSiHayInfra = hayInfraestructura ? describe : describe.skip;

/** PNG de 1x1 píxel: solo para pruebas; la aplicación nunca fabrica firmas. */
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';

async function contarImagenes(buffer: Buffer): Promise<number> {
  const documento = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  let total = 0;
  for (let n = 1; n <= documento.numPages; n++) {
    const operadores = await (await documento.getPage(n)).getOperatorList();
    total += operadores.fnArray.filter((f: number) => f === pdfjs.OPS.paintImageXObject).length;
  }
  return total;
}

const ACTOR = { id: null, usuario: 'SUP.INTEGRACION', rol: 'SUPERVISOR' };

async function esperar<T>(leer: () => Promise<T>, listo: (valor: T) => boolean, ms = 25_000): Promise<T> {
  const limite = Date.now() + ms;
  for (;;) {
    const valor = await leer();
    if (listo(valor)) return valor;
    if (Date.now() > limite) throw new Error(`Tiempo agotado esperando; último valor: ${JSON.stringify(valor)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

describeSiHayInfra('PDF asíncrono contra Redis, MinIO y PostgreSQL (GAF-54)', () => {
  jest.setTimeout(60_000);
  const bucket = `gafer-docs-it-${Date.now()}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let fallosPorProvocar = 0;
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let consumer: GenerarPdfConsumer;
  let clienteId: string;

  beforeAll(async () => {
    process.env.MINIO_BUCKET = bucket;
    const real = new PdfkitInformeRenderer();
    // Mismo motor, pero puede fallar a pedido para probar el error visible y el reintento.
    const renderizador = {
      renderizar: async (datos: DatosInformePdf) => {
        if (fallosPorProvocar > 0) {
          fallosPorProvocar -= 1;
          throw new Error('motor de PDF no disponible (simulado)');
        }
        return real.renderizar(datos);
      },
    };
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(PDF_RENDERER)
      .useValue(renderizador)
      .compile();
    await moduleRef.init();
    consumer = moduleRef.get(GenerarPdfConsumer);
    consumer.iniciar(1);

    const cliente = await pool.query(
      `INSERT INTO clientes (razon_social, ruc, codigo_corto, direccion_fiscal, giro_negocio, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo)
       VALUES ('Cliente Integración S.A.', $1, $2, 'Av. 1', 'Energía', 'Ana', 'Jefa', '999', 'a@example.com') RETURNING id`,
      [`20${String(Date.now()).slice(-9)}`, `IT${String(Date.now()).slice(-6)}`],
    );
    clienteId = cliente.rows[0].id;
  });

  afterAll(async () => {
    // Primero se detiene el worker: un trabajo en vuelo no debe tocar filas que se están borrando.
    await moduleRef.close();
    // La base impide cambiar la huella de un PDF emitido, pero no borrar el documento: se borra todo lo del cliente.
    await pool.query('DELETE FROM documentos_transiciones WHERE documento_id IN (SELECT id FROM documentos WHERE cliente_id = $1)', [clienteId]);
    await pool.query('DELETE FROM documentos WHERE cliente_id = $1', [clienteId]);
    await pool.query('DELETE FROM correlativos WHERE cliente_id = $1', [clienteId]);
    await pool.query('DELETE FROM clientes WHERE id = $1', [clienteId]);
    await pool.end();
  });

  async function aprobar(): Promise<string> {
    const crear = moduleRef.get(CrearDocumentoUseCase);
    const transicionar = moduleRef.get(TransicionarDocumentoUseCase);
    const doc = await crear.ejecutar(clienteId, 'INFORME', ACTOR);
    for (const estado of ['CERRADO', 'ENVIADO_A_REVISION', 'APROBADO'] as const) await transicionar.ejecutar(doc.id, estado, ACTOR);
    return doc.id;
  }

  async function crearDocumento(): Promise<string> {
    const doc = await moduleRef.get(CrearDocumentoUseCase).ejecutar(clienteId, 'INFORME', ACTOR);
    return doc.id;
  }

  async function aprobarExistente(id: string): Promise<void> {
    const transicionar = moduleRef.get(TransicionarDocumentoUseCase);
    for (const estado of ['CERRADO', 'ENVIADO_A_REVISION', 'APROBADO'] as const) await transicionar.ejecutar(id, estado, ACTOR);
  }

  const estadoPdf = (id: string) => async () => (await moduleRef.get(DOCUMENTO_REPOSITORY).buscarPorId(id))!.getPdf();

  it('crea el bucket si falta, genera el PDF al aprobar y lo guarda con clave determinista', async () => {
    const id = await aprobar();
    const pdf = await esperar(estadoPdf(id), (p) => p.estado === 'GENERADO');
    const codigo = (await moduleRef.get(DOCUMENTO_REPOSITORY).buscarPorId(id))!.codigo;
    expect(pdf.storageKey).toBe(`documentos/${id}/${codigo}.pdf`);
    expect(pdf.generadoAt).toBeInstanceOf(Date);
    expect(pdf.error).toBeNull();

    const bytes = await moduleRef.get(S3StorageService).obtenerBuffer(pdf.storageKey!);
    expect(bytes!.subarray(0, 5).toString()).toBe('%PDF-');
    expect(moduleRef.get(S3StorageService).getBucketName()).toBe(bucket);
    // GAF-56: la huella guardada es la de los bytes que quedaron en MinIO.
    expect(pdf.sha256).toBe(createHash('sha256').update(bytes!).digest('hex'));
  });

  it('un fallo deja ERROR visible y la cola reintenta hasta generar el PDF', async () => {
    fallosPorProvocar = 1;
    const id = await aprobar();
    const conError = await esperar(estadoPdf(id), (p) => p.estado === 'ERROR' || p.estado === 'GENERADO');
    expect(conError).toMatchObject({ estado: 'ERROR', error: expect.stringContaining('motor de PDF no disponible') });
    const recuperado = await esperar(estadoPdf(id), (p) => p.estado === 'GENERADO');
    expect(recuperado.error).toBeNull();
    expect(recuperado.intentos).toBe(2);
  });

  it('un trabajo duplicado no regenera un PDF ya generado', async () => {
    const id = await aprobar();
    await esperar(estadoPdf(id), (p) => p.estado === 'GENERADO');
    const antes = (await estadoPdf(id)()).generadoAt;
    const cola = new ColaPdfBullmq();
    await cola.encolar(id);
    await new Promise((r) => setTimeout(r, 1500));
    expect((await estadoPdf(id)()).generadoAt).toEqual(antes);
    await cola.onModuleDestroy();
  });

  it('estampa las firmas de Director Técnico y cliente cuando existen, y no se regenera al cambiar catálogo ni firmas (GAF-55, GAF-56)', async () => {
    const original = (await pool.query(`SELECT director_firma FROM configuracion_sistema WHERE id = 'global'`)).rows[0]?.director_firma ?? null;
    try {
      await pool.query(`UPDATE configuracion_sistema SET director_firma = $1 WHERE id = 'global'`, [`data:image/png;base64,${PNG_B64}`]);
      const id = await crearDocumento();
      await pool.query(`UPDATE documentos SET firma_cliente = $2 WHERE id = $1`, [id, `data:image/png;base64,${PNG_B64}`]);
      await aprobarExistente(id);
      const emitido = await esperar(estadoPdf(id), (p) => p.estado === 'GENERADO');
      const almacen = moduleRef.get(S3StorageService);
      const bytes = (await almacen.obtenerBuffer(emitido.storageKey!))!;
      expect(await contarImagenes(bytes)).toBe(2);

      // Cambia un texto del catálogo y la firma del Director: el PDF ya emitido no se toca.
      await pool.query(`UPDATE clientes SET giro_negocio = 'Giro cambiado después de emitir' WHERE id = $1`, [clienteId]);
      await pool.query(`UPDATE configuracion_sistema SET director_firma = NULL WHERE id = 'global'`);
      const cola = new ColaPdfBullmq();
      await cola.encolar(id);
      await new Promise((r) => setTimeout(r, 1500));
      await cola.onModuleDestroy();

      const despues = await estadoPdf(id)();
      expect(despues.sha256).toBe(emitido.sha256);
      expect(despues.generadoAt).toEqual(emitido.generadoAt);
      const bytesDespues = (await almacen.obtenerBuffer(emitido.storageKey!))!;
      expect(bytesDespues.equals(bytes)).toBe(true);
    } finally {
      await pool.query(`UPDATE configuracion_sistema SET director_firma = $1 WHERE id = 'global'`, [original]);
    }
  });
});
