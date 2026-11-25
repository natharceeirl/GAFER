// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
import { deflateSync } from 'zlib';
import type { DatosInformePdf } from '@gafer/api';
import { PdfkitInformeRenderer } from './pdfkit-informe.renderer';

/** PNG de 1x1 píxel, armado a mano para no depender de archivos binarios en el repositorio. */
function png1x1(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(1, 0);
  cabecera.writeUInt32BE(1, 4);
  cabecera[8] = 8;
  cabecera[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(Buffer.from([0, 200, 30, 30]))),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

function datosBase(extra: Partial<DatosInformePdf> = {}): DatosInformePdf {
  return {
    documento: { id: 'd1', tipo: 'INFORME', codigo: 'INFORME-QA001-001-2026', numeroCorrelativo: 1, estado: 'APROBADO', fecha: '2026-11-24' },
    empresa: { razonSocial: null, ruc: null, direccion: null, telefono: null },
    director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: null },
    cliente: {
      razonSocial: 'Cliente Prueba 001 S.A.',
      ruc: '20000000001',
      direccionFiscal: 'Av. Las Palmas 123, Mollendo',
      giroNegocio: 'Generación Eléctrica',
      contactoNombre: 'Carlos Ramos',
      contactoCargo: 'Jefe de SSOMA',
      contactoTelefono: '958123456',
    },
    sede: {
      nombre: 'PLANTA_001',
      direccion: 'Carretera Costanera Km 12',
      distrito: 'Mollendo',
      provincia: 'Islay',
      departamento: 'Arequipa',
      contactoNombre: 'Mario Vargas',
      contactoCargo: 'Supervisor de Planta',
    },
    servicios: [
      {
        tipoServicio: 'DRT',
        frecuencia: 'MENSUAL',
        areaTotalM2: 5000,
        areaTratarM2: 3500,
        insumos: [
          { producto: 'Cipermetrina 25%', principioActivo: 'Cipermetrina', registroDigesa: 'RD-1425-2024/DIGESA/SA', concentracion: '25% p/v', presentacion: 'LIQUIDO' },
        ],
        equipos: ['Nebulizadora ULV Vector Fog C-150 (EQ-NEB-001)'],
      },
    ],
    personal: [{ nombre: 'Juan Perez Gomez', cargo: 'Técnico Operador' }],
    inspeccion: null,
    aprobacion: { usuario: 'SUP.UNO', nombre: 'Sara Supervisora Demo', cargo: 'SUPERVISOR', fecha: '2026-11-25T20:30:00.000Z' },
    firmaCliente: null,
    fotos: [],
    ...extra,
  };
}

/** Texto de todas las hojas (pdf.js), para comprobar lo que realmente quedó escrito en el PDF. */
async function leer(buffer: Buffer) {
  const documento = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  let texto = '';
  for (let n = 1; n <= documento.numPages; n++) {
    const contenido = await (await documento.getPage(n)).getTextContent();
    texto += contenido.items.map((i: { str: string; hasEOL?: boolean }) => i.str + (i.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  return { texto, paginas: documento.numPages as number };
}

/** Cantidad de imágenes realmente dibujadas en el PDF (firmas y fotos). */
async function contarImagenes(buffer: Buffer): Promise<number> {
  const documento = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  let total = 0;
  for (let n = 1; n <= documento.numPages; n++) {
    const operadores = await (await documento.getPage(n)).getOperatorList();
    total += operadores.fnArray.filter((f: number) => f === pdfjs.OPS.paintImageXObject).length;
  }
  return total;
}

describe('PdfkitInformeRenderer (sección 6.1)', () => {
  const renderer = new PdfkitInformeRenderer();

  it('genera un PDF válido de una página con el código, el cliente y los datos de GAFER pendientes marcados', async () => {
    const pdf = await renderer.renderizar(datosBase());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-8).toString()).toContain('%%EOF');
    const { texto, paginas } = await leer(pdf);
    expect(paginas).toBeGreaterThanOrEqual(1);
    expect(texto).toContain('INFORME-QA001-001-2026');
    expect(texto).toContain('Cliente Prueba 001 S.A.');
    expect(texto).toContain('20000000001');
    expect(texto).toContain('Ing. Carlos Medina Ruiz');
    expect(texto).toContain('84512');
    expect(texto).toContain('Logo GAFER');
    expect(texto).toMatch(/Razón social:\s*No configurado/);
  });

  it('usa los datos de la empresa cuando están configurados', async () => {
    const pdf = await renderer.renderizar(
      datosBase({ empresa: { razonSocial: 'GAFER DEMO S.A.C.', ruc: '20999999991', direccion: 'Calle Demo 1', telefono: '999000111' } }),
    );
    const { texto } = await leer(pdf);
    expect(texto).toContain('GAFER DEMO S.A.C.');
    expect(texto).toContain('20999999991');
    expect(texto).toContain('999000111');
  });

  it('incluye las secciones de la 6.1 en orden, con tildes y ñ legibles', async () => {
    const { texto } = await leer(await renderer.renderizar(datosBase()));
    const orden = [
      '1. Diagnóstico',
      '2. Trabajos realizados',
      '3. Insumos',
      '4. Personal',
      '5. Acciones correctivas',
      '6. Observaciones y recomendaciones',
      '7. Fotografías',
      'Cierre',
      'Anexos',
    ];
    const posiciones = orden.map((t) => texto.indexOf(t));
    expect(posiciones.every((p) => p >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
    expect(texto).toContain('Establecimiento del cliente');
  });

  it('la tabla de insumos trae producto, DIGESA y concentración; el personal, nombre y cargo', async () => {
    const { texto } = await leer(await renderer.renderizar(datosBase()));
    expect(texto).toContain('Cipermetrina 25%');
    expect(texto).toContain('RD-1425-2024/DIGESA/SA');
    expect(texto).toContain('25% p/v');
    expect(texto).toContain('Juan Perez Gomez');
    expect(texto).toContain('Técnico Operador');
    expect(texto).toContain('Nebulizadora ULV Vector Fog C-150');
  });

  it('sin firmas disponibles deja marcas claras, no firmas inventadas, y los anexos pendientes (GAF-55)', async () => {
    const pdf = await renderer.renderizar(datosBase());
    // pdf.js separa en renglones lo que pdfkit parte en la caja: se compara con espacios normalizados.
    const texto = (await leer(pdf)).texto.replace(/\s+/g, ' ');
    expect(await contarImagenes(pdf)).toBe(0);
    expect(texto).toContain('Director Técnico');
    expect(texto).toContain('Firma del Director Técnico no configurada');
    expect(texto).toContain('Supervisor de Operaciones');
    expect(texto).toContain('Conformidad del cliente');
    expect(texto).toContain('Responsable no disponible');
    expect(texto).not.toContain('Firma pendiente');
    expect(texto).toContain('Certificado de saneamiento ambiental');
    expect(texto).toContain('Resolución de licencia');
    expect(texto).toContain('Anexo pendiente');
  });

  it('el Supervisor de Operaciones aparece con nombre, rol y fecha/hora de aprobación en hora de Lima (GAF-55)', async () => {
    const { texto } = await leer(await renderer.renderizar(datosBase()));
    expect(texto).toContain('Sara Supervisora Demo');
    expect(texto).toContain('SUP.UNO');
    expect(texto).toContain('Supervisor');
    expect(texto).toContain('25/11/2026 15:30');
  });

  it('sin aprobación registrada lo dice y no inventa persona', async () => {
    const { texto } = await leer(await renderer.renderizar(datosBase({ aprobacion: null })));
    expect(texto).toContain('Aprobador no registrado');
    expect(texto).not.toContain('Sara Supervisora Demo');
  });

  it('estampa la firma del Director Técnico y la del responsable del cliente cuando existen (GAF-55)', async () => {
    const solo = datosBase({ director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: png1x1() } });
    const pdfDirector = await renderer.renderizar(solo);
    expect(await contarImagenes(pdfDirector)).toBe(1);
    const textoDirector = (await leer(pdfDirector)).texto;
    expect(textoDirector).not.toContain('Firma del Director Técnico no configurada');
    expect(textoDirector).toContain('Responsable no disponible');

    const ambas = datosBase({ director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: png1x1() }, firmaCliente: png1x1() });
    const pdfAmbas = await renderer.renderizar(ambas);
    expect(await contarImagenes(pdfAmbas)).toBe(2);
    expect((await leer(pdfAmbas)).texto).not.toContain('Responsable no disponible');
  });

  it('una firma corrupta no tumba el PDF: queda la marca de ausencia', async () => {
    const pdf = await renderer.renderizar(datosBase({ firmaCliente: Buffer.from('no es una imagen') }));
    expect(await contarImagenes(pdf)).toBe(0);
    expect((await leer(pdf)).texto).toContain('Responsable no disponible');
  });

  it('las secciones sin datos dicen que no hay información en vez de quedar vacías', async () => {
    const { texto } = await leer(await renderer.renderizar(datosBase({ servicios: [], personal: [], sede: null })));
    expect(texto).toContain('Sin información registrada');
  });

  it('numera cada hoja como "Página X de Y" y pasa de página cuando hay mucho contenido', async () => {
    const muchos = Array.from({ length: 60 }, (_, i) => ({
      producto: `Producto ${i + 1}`,
      principioActivo: 'Activo',
      registroDigesa: `RD-${i + 1}`,
      concentracion: '10%',
      presentacion: 'LIQUIDO',
    }));
    const datos = datosBase();
    datos.servicios[0].insumos = muchos;
    const { texto, paginas } = await leer(await renderer.renderizar(datos));
    expect(paginas).toBeGreaterThan(1);
    for (let p = 1; p <= paginas; p++) expect(texto).toContain(`Página ${p} de ${paginas}`);
    expect(texto).toContain('Producto 60');
  });

  it('dibuja las fotografías (4 por hoja) con fecha y hora', async () => {
    const fotos = Array.from({ length: 5 }, (_, i) => ({ imagen: png1x1(), fecha: '2026-11-24', hora: `0${i + 1}:30` }));
    const sin = await leer(await renderer.renderizar(datosBase()));
    const con = await leer(await renderer.renderizar(datosBase({ fotos })));
    expect(con.paginas).toBeGreaterThanOrEqual(sin.paginas + 2);
    expect(con.texto).toContain('Foto 5');
    expect(con.texto).toContain('2026-11-24 05:30');
  });

  it('una foto corrupta no tumba el PDF: queda un aviso en su lugar', async () => {
    const { texto } = await leer(await renderer.renderizar(datosBase({ fotos: [{ imagen: Buffer.from('no es una imagen'), fecha: '2026-11-24', hora: '10:00' }] })));
    expect(texto).toContain('Foto 1');
    expect(texto).toContain('imagen no disponible');
  });
});
