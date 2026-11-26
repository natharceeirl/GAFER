import { clavePdfDocumento, Documento } from './documento';

const HUELLA = 'a'.repeat(64);

describe('Documento - estado del PDF (GAF-54)', () => {
  function aprobado(): Documento {
    const doc = new Documento('d1', 'c1', 1, { codigo: 'INFORME-KALLPA-001-2026' });
    doc.transicionarA('CERRADO');
    doc.transicionarA('ENVIADO_A_REVISION');
    doc.transicionarA('APROBADO');
    return doc;
  }

  it('un documento nuevo no tiene PDF', () => {
    expect(new Documento('d1', 'c1', 1).getPdf()).toEqual({ estado: null, storageKey: null, generadoAt: null, error: null, intentos: 0, sha256: null });
  });

  it('solo se puede pedir el PDF de un documento aprobado o enviado', () => {
    const doc = new Documento('d1', 'c1', 1);
    expect(() => doc.solicitarPdf()).toThrow('Solo se puede generar el PDF de un documento aprobado');
    doc.transicionarA('CERRADO');
    expect(() => doc.solicitarPdf()).toThrow('Solo se puede generar el PDF de un documento aprobado');

    const ok = aprobado();
    ok.solicitarPdf();
    expect(ok.getPdf().estado).toBe('PENDIENTE');
    ok.transicionarA('ENVIADO');
    expect(() => ok.solicitarPdf()).not.toThrow();
  });

  it('genera: PENDIENTE -> GENERANDO -> GENERADO con clave y fecha, y limpia el error', () => {
    const doc = aprobado();
    doc.solicitarPdf();
    doc.iniciarGeneracionPdf();
    expect(doc.getPdf()).toMatchObject({ estado: 'GENERANDO', intentos: 1 });
    const fecha = new Date('2026-11-24T15:00:00Z');
    doc.marcarPdfGenerado('documentos/d1/INFORME-KALLPA-001-2026.pdf', fecha, HUELLA);
    expect(doc.getPdf()).toEqual({
      estado: 'GENERADO',
      storageKey: 'documentos/d1/INFORME-KALLPA-001-2026.pdf',
      generadoAt: fecha,
      error: null,
      intentos: 1,
      sha256: HUELLA,
    });
  });

  it('un fallo deja ERROR visible con el motivo y se puede reintentar', () => {
    const doc = aprobado();
    doc.solicitarPdf();
    doc.iniciarGeneracionPdf();
    doc.marcarPdfFallido('MinIO no responde');
    expect(doc.getPdf()).toMatchObject({ estado: 'ERROR', error: 'MinIO no responde', storageKey: null });
    doc.iniciarGeneracionPdf();
    expect(doc.getPdf()).toMatchObject({ estado: 'GENERANDO', intentos: 2, error: null });
  });

  it('un PDF ya generado es inmutable: no se puede volver a pedir y conserva clave y huella (GAF-56)', () => {
    const doc = aprobado();
    doc.solicitarPdf();
    doc.iniciarGeneracionPdf();
    doc.marcarPdfGenerado('k.pdf', new Date(), HUELLA);
    expect(() => doc.solicitarPdf()).toThrow('ya fue emitido');
    doc.transicionarA('ENVIADO');
    expect(() => doc.solicitarPdf()).toThrow('ya fue emitido');
    expect(doc.getPdf()).toMatchObject({ estado: 'GENERADO', storageKey: 'k.pdf', sha256: HUELLA });
  });

  it('tras un ERROR se puede pedir de nuevo (todavía no hay PDF emitido)', () => {
    const doc = aprobado();
    doc.solicitarPdf();
    doc.iniciarGeneracionPdf();
    doc.marcarPdfFallido('x');
    expect(() => doc.solicitarPdf()).not.toThrow();
    expect(doc.getPdf()).toMatchObject({ estado: 'PENDIENTE', intentos: 0, error: null });
  });

  it('la huella debe ser un SHA-256 hexadecimal de 64 caracteres', () => {
    const doc = aprobado();
    doc.solicitarPdf();
    doc.iniciarGeneracionPdf();
    expect(() => doc.marcarPdfGenerado('k.pdf', new Date(), 'abc')).toThrow('SHA-256');
  });

  it('no se puede marcar generado ni fallido un PDF que no se está generando', () => {
    const doc = aprobado();
    expect(() => doc.marcarPdfGenerado('k.pdf', new Date(), HUELLA)).toThrow('no se está generando');
    expect(() => doc.marcarPdfFallido('x')).toThrow('no se está generando');
  });

  it('la clave de almacenamiento es determinista', () => {
    expect(clavePdfDocumento('d1', 'INFORME-KALLPA-001-2026')).toBe('documentos/d1/INFORME-KALLPA-001-2026.pdf');
  });
});
