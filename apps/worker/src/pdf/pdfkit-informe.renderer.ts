import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { DatosInformePdf, FotoPdf, InsumoPdf } from '@gafer/api';

type Doc = InstanceType<typeof PDFDocument>;

const MARGEN = 50;
const ANCHO_UTIL = 595.28 - MARGEN * 2;
const BAJO_MARGEN = 842 - MARGEN - 20;
const COLOR_TEXTO = '#1f2933';
const COLOR_SUAVE = '#6b7280';
const COLOR_LINEA = '#9aa5b1';
const COLOR_FONDO = '#eef1f4';
const NO_CONFIGURADO = 'No configurado';

const TITULOS: Record<string, string> = {
  INFORME: 'INFORME DE SERVICIO',
  REPORTE: 'REPORTE DE INSPECCIÓN',
  CERTIFICADO: 'CERTIFICADO',
};

const SERVICIOS: Record<string, string> = {
  DRT: 'Desratización (DRT)',
  DSI: 'Desinsectización (DSI)',
  DSF: 'Desinfección (DSF)',
};

/**
 * Motor de PDF: pdfkit (PoC GAF-41). Solo Node, sin navegador ni binarios: cabe en un VPS chico, dibuja
 * texto, tablas e imágenes y entiende tildes y ñ con las fuentes estándar del PDF (WinAnsi).
 * Sigue la estructura de la sección 6.1; lo que todavía no tiene fuente de datos queda como
 * marcador visible (firmas: GAF-55; anexos: biblioteca de anexos), nunca como dato inventado.
 */
@Injectable()
export class PdfkitInformeRenderer {
  renderizar(datos: DatosInformePdf): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGEN, bottom: MARGEN + 20, left: MARGEN, right: MARGEN },
        bufferPages: true,
        info: { Title: `${TITULOS[datos.documento.tipo] ?? 'Documento'} ${datos.documento.codigo}`, Author: datos.empresa.razonSocial ?? 'GAFER', Producer: 'GAFER' },
      });
      const partes: Buffer[] = [];
      doc.on('data', (p: Buffer) => partes.push(p));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);

      try {
        dibujar(doc, datos);
        numerarPaginas(doc, datos.documento.codigo);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

function dibujar(doc: Doc, d: DatosInformePdf): void {
  encabezado(doc, d);
  establecimiento(doc, d);

  seccion(doc, '1. Diagnóstico');
  vacio(doc, 'Estado general de áreas, evaluación de plagas y condición sanitaria de la zona circundante.');

  seccion(doc, '2. Trabajos realizados');
  if (d.servicios.length === 0) vacio(doc);
  for (const s of d.servicios) {
    filaDatos(doc, [
      ['Tipo de servicio', SERVICIOS[s.tipoServicio] ?? s.tipoServicio],
      ['Frecuencia', s.frecuencia],
      ['Área total / a tratar', `${s.areaTotalM2} m² / ${s.areaTratarM2} m²`],
      ['Equipos', s.equipos.length ? s.equipos.join('; ') : 'Sin equipos autorizados'],
    ]);
    doc.moveDown(0.4);
  }
  if (d.inspeccion) {
    const horas = [d.inspeccion.horaInicio, d.inspeccion.horaFin].filter(Boolean).join(' a ');
    filaDatos(doc, [
      ['Inspección', d.inspeccion.codigo],
      ['Fecha de ejecución', `${d.inspeccion.fechaEjecucion}${horas ? ` (${horas})` : ''}`],
    ]);
  }

  seccion(doc, '3. Insumos');
  const insumos = d.servicios.flatMap((s) => s.insumos);
  if (insumos.length === 0) vacio(doc);
  else tablaInsumos(doc, insumos);

  seccion(doc, '4. Personal');
  if (d.personal.length === 0) vacio(doc, 'Nombre y cargo de cada persona que intervino.');
  else
    tabla(
      doc,
      [
        { titulo: 'Nombre', ancho: 0.6 },
        { titulo: 'Cargo', ancho: 0.4 },
      ],
      d.personal.map((p) => [p.nombre, p.cargo]),
    );

  seccion(doc, '5. Acciones correctivas');
  vacio(doc, 'Acciones ejecutadas vinculadas al hallazgo y tipo de servicio.');

  seccion(doc, '6. Observaciones y recomendaciones');
  vacio(doc, 'Observaciones técnicas y recomendaciones al cliente.');

  seccion(doc, '7. Fotografías');
  if (d.fotos.length === 0) vacio(doc, 'Hasta 20 fotografías seleccionadas por el Supervisor.');
  else fotografias(doc, d);

  cierre(doc, d);
  anexos(doc);
}

function encabezado(doc: Doc, d: DatosInformePdf): void {
  const y0 = doc.y;
  // Placeholder del logo: no se inventa un logo de la empresa.
  doc.save().rect(MARGEN, y0, 96, 48).dash(3, { space: 2 }).strokeColor(COLOR_LINEA).stroke().undash().restore();
  doc.font('Helvetica').fontSize(7.5).fillColor(COLOR_SUAVE).text('[Logo GAFER]', MARGEN, y0 + 14, { width: 96, align: 'center' });
  doc.text('(pendiente de cargar)', MARGEN, y0 + 25, { width: 96, align: 'center' });

  const x = MARGEN + 112;
  const ancho = ANCHO_UTIL - 112;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO);
  doc.text(`Razón social: ${d.empresa.razonSocial ?? NO_CONFIGURADO}`, x, y0, { width: ancho });
  doc.font('Helvetica').fontSize(8.5);
  doc.text(`RUC: ${d.empresa.ruc ?? NO_CONFIGURADO}   ·   Teléfono: ${d.empresa.telefono ?? NO_CONFIGURADO}`, x, doc.y, { width: ancho });
  doc.text(`Dirección: ${d.empresa.direccion ?? NO_CONFIGURADO}`, x, doc.y, { width: ancho });
  doc.text(`Director Técnico: ${d.director.nombre || NO_CONFIGURADO}   ·   CIP: ${d.director.cip || NO_CONFIGURADO}`, x, doc.y, { width: ancho });

  doc.y = Math.max(doc.y, y0 + 48) + 12;
  doc.x = MARGEN;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLOR_TEXTO).text(TITULOS[d.documento.tipo] ?? 'DOCUMENTO', MARGEN, doc.y, { width: ANCHO_UTIL, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10.5).text(`N° ${d.documento.codigo}`, MARGEN, doc.y + 2, { width: ANCHO_UTIL, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_SUAVE).text(`Fecha de emisión: ${d.documento.fecha}`, MARGEN, doc.y + 2, { width: ANCHO_UTIL, align: 'center' });
  doc.moveDown(0.8);
}

function establecimiento(doc: Doc, d: DatosInformePdf): void {
  seccion(doc, 'Establecimiento del cliente');
  const filas: Array<[string, string]> = [
    ['Razón social', d.cliente.razonSocial],
    ['RUC', d.cliente.ruc],
    ['Dirección fiscal', d.cliente.direccionFiscal],
    ['Giro de negocio', d.cliente.giroNegocio],
  ];
  if (d.sede) {
    filas.push(
      ['Sede', d.sede.nombre],
      ['Dirección de la sede', `${d.sede.direccion}, ${d.sede.distrito}, ${d.sede.provincia}, ${d.sede.departamento}`],
      ['Contacto en sede', `${d.sede.contactoNombre} (${d.sede.contactoCargo})`],
    );
  } else {
    filas.push(['Contacto', `${d.cliente.contactoNombre} (${d.cliente.contactoCargo}) · ${d.cliente.contactoTelefono}`]);
  }
  filaDatos(doc, filas);
}

function seccion(doc: Doc, titulo: string): void {
  asegurarEspacio(doc, 60);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.save().rect(MARGEN, y, ANCHO_UTIL, 17).fill(COLOR_FONDO).restore();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_TEXTO).text(titulo, MARGEN + 6, y + 4, { width: ANCHO_UTIL - 12 });
  doc.y = y + 17 + 5;
  doc.x = MARGEN;
}

function vacio(doc: Doc, ayuda?: string): void {
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(COLOR_SUAVE);
  doc.text(`Sin información registrada${ayuda ? `. ${ayuda}` : '.'}`, MARGEN, doc.y, { width: ANCHO_UTIL });
}

function filaDatos(doc: Doc, filas: Array<[string, string]>): void {
  for (const [clave, valor] of filas) {
    asegurarEspacio(doc, 16);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_SUAVE).text(clave, MARGEN, y, { width: 118 });
    const finClave = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_TEXTO).text(valor || '—', MARGEN + 124, y, { width: ANCHO_UTIL - 124 });
    doc.y = Math.max(finClave, doc.y) + 2;
  }
  doc.x = MARGEN;
}

interface Columna {
  titulo: string;
  /** Fracción del ancho útil. */
  ancho: number;
}

function tabla(doc: Doc, columnas: Columna[], filas: string[][]): void {
  const anchos = columnas.map((c) => c.ancho * ANCHO_UTIL);
  const cabecera = () => {
    asegurarEspacio(doc, 30);
    const y = doc.y;
    doc.save().rect(MARGEN, y, ANCHO_UTIL, 15).fill(COLOR_FONDO).restore();
    let x = MARGEN;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_TEXTO);
    columnas.forEach((c, i) => {
      doc.text(c.titulo, x + 3, y + 4, { width: anchos[i] - 6, lineBreak: false });
      x += anchos[i];
    });
    doc.y = y + 15;
  };
  cabecera();
  doc.font('Helvetica').fontSize(8);
  for (const fila of filas) {
    const alto = Math.max(...fila.map((celda, i) => doc.heightOfString(celda, { width: anchos[i] - 6 }))) + 6;
    if (doc.y + alto > BAJO_MARGEN) {
      doc.addPage();
      cabecera();
      doc.font('Helvetica').fontSize(8);
    }
    const y = doc.y;
    let x = MARGEN;
    doc.fillColor(COLOR_TEXTO);
    fila.forEach((celda, i) => {
      doc.text(celda, x + 3, y + 3, { width: anchos[i] - 6 });
      x += anchos[i];
    });
    doc.save().moveTo(MARGEN, y + alto).lineTo(MARGEN + ANCHO_UTIL, y + alto).lineWidth(0.4).strokeColor(COLOR_LINEA).stroke().restore();
    doc.y = y + alto;
  }
  doc.x = MARGEN;
}

function tablaInsumos(doc: Doc, insumos: InsumoPdf[]): void {
  // Lote, vencimiento, cantidad y zonas salen del registro de campo (aún sin tabla propia): se dejan en blanco.
  tabla(
    doc,
    [
      { titulo: 'Producto', ancho: 0.22 },
      { titulo: 'Lote', ancho: 0.1 },
      { titulo: 'Vencim.', ancho: 0.1 },
      { titulo: 'N° DIGESA', ancho: 0.22 },
      { titulo: 'Cantidad', ancho: 0.1 },
      { titulo: 'Concentración', ancho: 0.13 },
      { titulo: 'Zonas', ancho: 0.13 },
    ],
    insumos.map((i) => [i.producto, '—', '—', i.registroDigesa, '—', i.concentracion, '—']),
  );
}

function fotografias(doc: Doc, d: DatosInformePdf): void {
  const fotos = d.fotos.slice(0, 20);
  const celdaAncho = (ANCHO_UTIL - 12) / 2;
  const celdaAlto = 300;
  fotos.forEach((foto: FotoPdf, i) => {
    if (i % 4 === 0) doc.addPage();
    const pos = i % 4;
    const x = MARGEN + (pos % 2) * (celdaAncho + 12);
    const y = MARGEN + 10 + Math.floor(pos / 2) * (celdaAlto + 12);
    doc.save().rect(x, y, celdaAncho, celdaAlto).lineWidth(0.5).strokeColor(COLOR_LINEA).stroke().restore();
    try {
      doc.image(foto.imagen, x + 4, y + 4, { fit: [celdaAncho - 8, celdaAlto - 40], align: 'center', valign: 'center' });
    } catch {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLOR_SUAVE).text('(imagen no disponible)', x + 4, y + celdaAlto / 2 - 6, { width: celdaAncho - 8, align: 'center' });
    }
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXTO);
    doc.text(`Foto ${i + 1} · ${foto.fecha} ${foto.hora}`, x + 4, y + celdaAlto - 32, { width: celdaAncho - 8 });
    doc.text(d.empresa.razonSocial ?? 'GAFER', x + 4, y + celdaAlto - 20, { width: celdaAncho - 8 });
  });
  doc.addPage();
}

function cierre(doc: Doc, d: DatosInformePdf): void {
  seccion(doc, 'Cierre');
  filaDatos(doc, [
    ['N° de certificado', '—'],
    ['Vencimiento', '—'],
  ]);
  doc.moveDown(0.6);
  asegurarEspacio(doc, 120);

  const ancho = (ANCHO_UTIL - 20) / 3;
  const y = doc.y;
  const cajas: Caja[] = [
    {
      titulo: 'Director Técnico',
      firma: d.director.firma,
      sinFirma: 'Firma del Director Técnico no configurada',
      lineas: [d.director.nombre || NO_CONFIGURADO, `CIP ${d.director.cip || NO_CONFIGURADO}`],
    },
    {
      titulo: 'Supervisor de Operaciones',
      // El Supervisor no tiene imagen de firma guardada: consta quién aprobó, con qué cargo y cuándo.
      firma: null,
      sinFirma: d.aprobacion ? 'Aprobación registrada en el sistema' : 'Aprobador no registrado',
      lineas: d.aprobacion
        ? [
            d.aprobacion.nombre ? `${d.aprobacion.nombre} (${d.aprobacion.usuario})` : d.aprobacion.usuario,
            CARGOS[d.aprobacion.cargo] ?? d.aprobacion.cargo,
            `Aprobado el ${fechaHoraLima(d.aprobacion.fecha)}`,
          ]
        : [],
    },
    {
      titulo: 'Conformidad del cliente',
      firma: d.firmaCliente,
      sinFirma: 'Responsable no disponible al momento del servicio',
      lineas: [`Cliente: ${d.cliente.razonSocial}`],
    },
  ];
  cajas.forEach((caja, i) => {
    const x = MARGEN + i * (ancho + 10);
    doc.save().rect(x, y, ancho, ALTO_CAJA_FIRMA).dash(3, { space: 2 }).strokeColor(COLOR_LINEA).stroke().undash().restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_TEXTO).text(caja.titulo, x + 6, y + 6, { width: ancho - 12 });
    if (!caja.firma || !dibujarFirma(doc, caja.firma, x + 10, y + 22, ancho - 20, 56)) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLOR_SUAVE).text(caja.sinFirma, x + 10, y + 40, { width: ancho - 20, align: 'center' });
    }
    doc.save().moveTo(x + 10, y + 82).lineTo(x + ancho - 10, y + 82).lineWidth(0.5).strokeColor(COLOR_LINEA).stroke().restore();
    doc.font('Helvetica').fontSize(7.5).fillColor(COLOR_TEXTO).text(caja.lineas.join('\n'), x + 6, y + 86, { width: ancho - 12 });
  });
  doc.y = y + ALTO_CAJA_FIRMA + 8;
  doc.x = MARGEN;
}

interface Caja {
  titulo: string;
  /** Imagen de la firma; `null` si no hay una utilizable. */
  firma: Buffer | null;
  /** Marca visible cuando no hay imagen: nunca se dibuja una firma que no existe. */
  sinFirma: string;
  lineas: string[];
}

const ALTO_CAJA_FIRMA = 124;

const CARGOS: Record<string, string> = {
  SUPERVISOR: 'Supervisor de Operaciones',
  ADMINISTRADOR: 'Administrador',
  TECNICO_OPERADOR: 'Técnico Operador',
};

/** `false` si la imagen no se pudo dibujar (corrupta): el llamador deja la marca de ausencia. */
function dibujarFirma(doc: Doc, imagen: Buffer, x: number, y: number, ancho: number, alto: number): boolean {
  try {
    doc.image(imagen, x, y, { fit: [ancho, alto], align: 'center', valign: 'center' });
    return true;
  } catch {
    return false;
  }
}

/** dd/mm/aaaa HH:mm en hora de Lima (UTC-5, sin horario de verano). */
function fechaHoraLima(iso: string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

function anexos(doc: Doc): void {
  seccion(doc, 'Anexos');
  const lista = [
    'Certificado de saneamiento ambiental',
    'Hoja de conformidad de servicios',
    'Fichas técnicas de productos',
    'Hojas de seguridad (MSDS)',
    'Resolución de licencia',
  ];
  doc.font('Helvetica').fontSize(9).fillColor(COLOR_TEXTO);
  for (const nombre of lista) {
    asegurarEspacio(doc, 14);
    doc.text(`•  ${nombre}  —  Anexo pendiente (biblioteca de anexos)`, MARGEN + 4, doc.y, { width: ANCHO_UTIL - 4 });
  }
}

function asegurarEspacio(doc: Doc, alto: number): void {
  if (doc.y + alto > BAJO_MARGEN) doc.addPage();
}

/** "Página X de Y" y el código del documento al pie de cada hoja. */
function numerarPaginas(doc: Doc, codigo: string): void {
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    // Se baja el margen inferior a 0: escribir en el pie no debe disparar un salto de página.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_SUAVE);
    doc.text(codigo, MARGEN, 842 - 40, { width: ANCHO_UTIL / 2, align: 'left', lineBreak: false });
    doc.text(`Página ${i + 1} de ${rango.count}`, MARGEN + ANCHO_UTIL / 2, 842 - 40, { width: ANCHO_UTIL / 2, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenInferior;
  }
}
