import { createHash } from 'crypto';
import { ConflictException, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CrearDocumentoUseCase } from './crear-documento.usecase';
import { TransicionarDocumentoUseCase } from './transicionar-documento.usecase';
import { SolicitarPdfDocumentoUseCase } from './solicitar-pdf-documento.usecase';
import { GenerarPdfDocumentoUseCase } from './generar-pdf-documento.usecase';
import { ObtenerPdfDocumentoUseCase, PdfIntegridadException } from './obtener-pdf-documento.usecase';
import { DocumentoRepositoryMemory } from '../infrastructure/documento.repository.memory';
import { NumeradorCorrelativoMemory } from '../infrastructure/numerador-correlativo.memory';
import { TransaccionMemory } from '../infrastructure/transaccion.memory';
import { ClienteCodigoMemory } from '../infrastructure/cliente-codigo.memory';
import { AlmacenPdfMemory, ColaPdfMemory } from '../infrastructure/pdf.memory';
import { DatosInformePdf } from '../domain/ports/pdf.ports';

const ACTOR = { id: '11111111-1111-4111-8111-111111111111', usuario: 'SUP.UNO', rol: 'SUPERVISOR' };

function datosDe(id: string, codigo: string): DatosInformePdf {
  return {
    documento: { id, tipo: 'INFORME', codigo, numeroCorrelativo: 1, estado: 'APROBADO', fecha: '2026-11-24' },
    empresa: { razonSocial: null, ruc: null, direccion: null, telefono: null },
    director: { nombre: 'Ing. Demo', cip: '00000', firma: null },
    cliente: {
      razonSocial: 'Cliente Demo S.A.',
      ruc: '20123456789',
      direccionFiscal: 'Av. 1',
      giroNegocio: 'Energía',
      contactoNombre: 'Ana',
      contactoCargo: 'Jefa',
      contactoTelefono: '999',
    },
    sede: null,
    servicios: [],
    personal: [],
    inspeccion: null,
    aprobacion: null,
    firmaCliente: null,
    fotos: [],
  };
}

function montar() {
  const repo = new DocumentoRepositoryMemory();
  const tx = new TransaccionMemory();
  const cola = new ColaPdfMemory();
  const almacen = new AlmacenPdfMemory();
  const solicitar = new SolicitarPdfDocumentoUseCase(repo, tx, cola);
  const transicionar = new TransicionarDocumentoUseCase(repo, tx, solicitar);
  const crear = new CrearDocumentoUseCase(
    repo,
    new NumeradorCorrelativoMemory(),
    new ClienteCodigoMemory({ 'cli-1': 'KALLPA' }),
    tx,
  );
  const renderizados: string[] = [];
  const renderer = {
    fallar: null as Error | null,
    async renderizar(datos: DatosInformePdf): Promise<Buffer> {
      renderizados.push(datos.documento.id);
      if (renderer.fallar) throw renderer.fallar;
      return Buffer.from(`%PDF-fake ${datos.documento.codigo} ${datos.cliente.giroNegocio}`);
    },
  };
  const datos = {
    nulo: false,
    /** Texto de catálogo que entra al PDF (p. ej. giro de negocio): se puede cambiar entre generaciones. */
    textoCatalogo: 'Energía',
    async cargar(id: string): Promise<DatosInformePdf | null> {
      if (datos.nulo) return null;
      const doc = await repo.buscarPorId(id);
      if (!doc) return null;
      const base = datosDe(id, doc.codigo);
      return { ...base, cliente: { ...base.cliente, giroNegocio: datos.textoCatalogo } };
    },
  };
  const generar = new GenerarPdfDocumentoUseCase(repo, tx, datos, renderer, almacen);
  const obtener = new ObtenerPdfDocumentoUseCase(repo, almacen);

  async function aprobado(): Promise<string> {
    const doc = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    await transicionar.ejecutar(doc.id, 'CERRADO', ACTOR);
    await transicionar.ejecutar(doc.id, 'ENVIADO_A_REVISION', ACTOR);
    cola.trabajos.length = 0;
    await transicionar.ejecutar(doc.id, 'APROBADO', ACTOR);
    return doc.id;
  }

  return { repo, cola, almacen, solicitar, transicionar, generar, obtener, renderer, renderizados, datos, aprobado, crear };
}

describe('SolicitarPdfDocumentoUseCase', () => {
  it('encola el trabajo y deja el PDF en PENDIENTE', async () => {
    const { solicitar, aprobado, cola, repo } = montar();
    const id = await aprobado();
    cola.trabajos.length = 0;
    await solicitar.ejecutar(id);
    expect(cola.trabajos).toEqual([id]);
    expect((await repo.buscarPorId(id))!.getPdf().estado).toBe('PENDIENTE');
  });

  it('rechaza un documento que aún no está aprobado y no encola nada', async () => {
    const { solicitar, crear, cola } = montar();
    const doc = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    await expect(solicitar.ejecutar(doc.id)).rejects.toThrow(ConflictException);
    expect(cola.trabajos).toHaveLength(0);
  });

  it('un documento inexistente responde NotFound', async () => {
    const { solicitar } = montar();
    await expect(solicitar.ejecutar('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('si la cola falla deja el error visible en el documento y avisa a quien lo pidió', async () => {
    const { solicitar, aprobado, cola, repo } = montar();
    const id = await aprobado();
    cola.fallar = new Error('ECONNREFUSED redis');
    await expect(solicitar.ejecutar(id)).rejects.toThrow(ServiceUnavailableException);
    expect((await repo.buscarPorId(id))!.getPdf()).toMatchObject({
      estado: 'ERROR',
      error: expect.stringContaining('ECONNREFUSED redis'),
    });
    cola.fallar = null;
    await solicitar.ejecutar(id);
    expect((await repo.buscarPorId(id))!.getPdf()).toMatchObject({ estado: 'PENDIENTE', error: null });
  });
});

describe('aprobar un documento encola su PDF', () => {
  it('al pasar a APROBADO se encola exactamente un trabajo; otras transiciones no', async () => {
    const { crear, transicionar, cola, repo } = montar();
    const doc = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    await transicionar.ejecutar(doc.id, 'CERRADO', ACTOR);
    await transicionar.ejecutar(doc.id, 'ENVIADO_A_REVISION', ACTOR);
    await transicionar.ejecutar(doc.id, 'OBSERVADO', ACTOR);
    await transicionar.ejecutar(doc.id, 'ENVIADO_A_REVISION', ACTOR);
    expect(cola.trabajos).toHaveLength(0);
    await transicionar.ejecutar(doc.id, 'APROBADO', ACTOR);
    expect(cola.trabajos).toEqual([doc.id]);
    expect((await repo.buscarPorId(doc.id))!.getPdf().estado).toBe('PENDIENTE');
  });

  it('si la cola está caída la aprobación igual se guarda y el error del PDF queda visible', async () => {
    const { crear, transicionar, cola, repo } = montar();
    const doc = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    await transicionar.ejecutar(doc.id, 'CERRADO', ACTOR);
    await transicionar.ejecutar(doc.id, 'ENVIADO_A_REVISION', ACTOR);
    cola.fallar = new Error('redis caído');
    const aprobado = await transicionar.ejecutar(doc.id, 'APROBADO', ACTOR);
    expect(aprobado.getEstado()).toBe('APROBADO');
    const guardado = (await repo.buscarPorId(doc.id))!;
    expect(guardado.getEstado()).toBe('APROBADO');
    expect(guardado.getPdf()).toMatchObject({ estado: 'ERROR', error: expect.stringContaining('redis caído') });
  });
});

describe('GenerarPdfDocumentoUseCase', () => {
  it('renderiza, guarda en la clave determinista y registra clave y fecha', async () => {
    const { generar, aprobado, almacen, repo, renderizados } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    const doc = (await repo.buscarPorId(id))!;
    const pdf = doc.getPdf();
    expect(pdf).toMatchObject({ estado: 'GENERADO', error: null, storageKey: `documentos/${id}/${doc.codigo}.pdf` });
    expect(pdf.generadoAt).toBeInstanceOf(Date);
    expect((await almacen.obtener(pdf.storageKey!))!.toString()).toContain(doc.codigo);
    expect(renderizados).toEqual([id]);
  });

  it('un documento inexistente falla con un mensaje claro', async () => {
    const { generar } = montar();
    await expect(generar.ejecutar('no-existe')).rejects.toThrow('Documento no-existe no encontrado');
  });

  it('es idempotente: un trabajo duplicado sobre un PDF ya generado no vuelve a renderizar', async () => {
    const { generar, aprobado, renderizados } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    await generar.ejecutar(id);
    await Promise.all([generar.ejecutar(id), generar.ejecutar(id)]);
    expect(renderizados).toEqual([id]);
  });

  it('si el renderizado falla deja ERROR con el motivo, propaga el error y el reintento lo recupera', async () => {
    const { generar, aprobado, renderer, repo } = montar();
    const id = await aprobado();
    renderer.fallar = new Error('motor de PDF roto');
    await expect(generar.ejecutar(id)).rejects.toThrow('motor de PDF roto');
    expect((await repo.buscarPorId(id))!.getPdf()).toMatchObject({ estado: 'ERROR', error: 'motor de PDF roto', storageKey: null });

    renderer.fallar = null;
    await generar.ejecutar(id);
    expect((await repo.buscarPorId(id))!.getPdf()).toMatchObject({ estado: 'GENERADO', error: null });
  });

  it('si falla el almacenamiento también deja ERROR visible', async () => {
    const { generar, aprobado, almacen, repo } = montar();
    const id = await aprobado();
    almacen.fallar = new Error('MinIO caído');
    await expect(generar.ejecutar(id)).rejects.toThrow('MinIO caído');
    expect((await repo.buscarPorId(id))!.getPdf()).toMatchObject({ estado: 'ERROR', error: 'MinIO caído' });
  });

  it('si no hay datos para armar el PDF deja ERROR', async () => {
    const { generar, aprobado, datos, repo } = montar();
    const id = await aprobado();
    datos.nulo = true;
    await expect(generar.ejecutar(id)).rejects.toThrow('no se encontraron los datos');
    expect((await repo.buscarPorId(id))!.getPdf().estado).toBe('ERROR');
  });

  it('guarda el SHA-256 de los bytes exactos almacenados (GAF-56)', async () => {
    const { generar, aprobado, almacen, repo } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    const pdf = (await repo.buscarPorId(id))!.getPdf();
    const bytes = (await almacen.obtener(pdf.storageKey!))!;
    expect(pdf.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });

  it('un PDF ya generado no se regenera: pedirlo otra vez responde 409 y no toca archivo, huella ni cola (GAF-56)', async () => {
    const { generar, solicitar, aprobado, renderizados, repo, almacen, cola } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    const antes = (await repo.buscarPorId(id))!.getPdf();
    const bytesAntes = Buffer.from((await almacen.obtener(antes.storageKey!))!);
    cola.trabajos.length = 0;

    await expect(solicitar.ejecutar(id)).rejects.toThrow(ConflictException);
    await expect(solicitar.ejecutar(id)).rejects.toThrow('ya fue emitido');
    await generar.ejecutar(id);

    expect(cola.trabajos).toHaveLength(0);
    expect(renderizados).toEqual([id]);
    expect((await repo.buscarPorId(id))!.getPdf()).toEqual(antes);
    expect((await almacen.obtener(antes.storageKey!))!.equals(bytesAntes)).toBe(true);
  });

  it('cambiar un texto del catálogo no cambia el PDF ya emitido (Listo cuando, GAF-56)', async () => {
    const { generar, obtener, solicitar, aprobado, datos, repo } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    const emitido = await obtener.ejecutar(id);
    const huella = (await repo.buscarPorId(id))!.getPdf().sha256;
    expect(emitido.contenido.toString()).toContain('Energía');

    datos.textoCatalogo = 'Minería (texto nuevo del catálogo)';
    await expect(solicitar.ejecutar(id)).rejects.toThrow(ConflictException);
    await generar.ejecutar(id);

    const despues = await obtener.ejecutar(id);
    expect(despues.contenido.equals(emitido.contenido)).toBe(true);
    expect(despues.contenido.toString()).not.toContain('texto nuevo');
    expect((await repo.buscarPorId(id))!.getPdf().sha256).toBe(huella);
  });
});

describe('ObtenerPdfDocumentoUseCase', () => {
  it('devuelve el contenido y el nombre del archivo del PDF generado', async () => {
    const { generar, obtener, aprobado, repo } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    const pdf = await obtener.ejecutar(id);
    expect(pdf.nombreArchivo).toBe(`${(await repo.buscarPorId(id))!.codigo}.pdf`);
    expect(pdf.contenido.toString()).toContain('%PDF');
  });

  it('404 si el documento no existe', async () => {
    const { obtener } = montar();
    await expect(obtener.ejecutar('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('409 mientras el PDF no esté generado, y con ERROR explica el motivo', async () => {
    const { obtener, aprobado, solicitar, generar, renderer } = montar();
    const id = await aprobado();
    await expect(obtener.ejecutar(id)).rejects.toThrow(ConflictException);
    await solicitar.ejecutar(id);
    await expect(obtener.ejecutar(id)).rejects.toThrow('todavía no está generado');
    renderer.fallar = new Error('motor roto');
    await expect(generar.ejecutar(id)).rejects.toThrow();
    await expect(obtener.ejecutar(id)).rejects.toThrow('motor roto');
  });

  it('404 si el registro dice GENERADO pero el archivo ya no está en el almacenamiento', async () => {
    const { generar, obtener, aprobado, almacen } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    almacen.vaciar();
    await expect(obtener.ejecutar(id)).rejects.toThrow(NotFoundException);
  });

  it('verifica la huella antes de servir: si los bytes cambiaron falla con 500 y un mensaje claro (GAF-56)', async () => {
    const { generar, obtener, aprobado, almacen, repo } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    const { storageKey } = (await repo.buscarPorId(id))!.getPdf();
    await almacen.guardar(storageKey!, Buffer.from('%PDF-fake adulterado'));

    const error = await obtener.ejecutar(id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(error).toBeInstanceOf(PdfIntegridadException);
    expect((error as Error).message).toContain('no coincide con su huella SHA-256');
    expect((error as PdfIntegridadException).documentoId).toBe(id);
  });

  it('un PDF GENERADO sin huella registrada tampoco se sirve', async () => {
    const { generar, obtener, aprobado, repo } = montar();
    const id = await aprobado();
    await generar.ejecutar(id);
    const doc = (await repo.buscarPorId(id))!;
    (doc as unknown as { pdf: { sha256: string | null } }).pdf.sha256 = null;
    await repo.guardar(doc);
    await expect(obtener.ejecutar(id)).rejects.toThrow(PdfIntegridadException);
  });
});
