import { construirCodigoDocumento, Documento } from './documento';

describe('Documento - flujo de aprobación', () => {
  it('arranca en BORRADOR', () => {
    const doc = new Documento('d1', 'c1', 1);
    expect(doc.getEstado()).toBe('BORRADOR');
  });

  it('sigue el camino feliz completo hasta ENVIADO', () => {
    const doc = new Documento('d1', 'c1', 1);
    doc.transicionarA('CERRADO');
    doc.transicionarA('ENVIADO_A_REVISION');
    doc.transicionarA('APROBADO');
    doc.transicionarA('ENVIADO');
    expect(doc.getEstado()).toBe('ENVIADO');
  });

  it('permite el camino de observación y corrección', () => {
    const doc = new Documento('d2', 'c1', 2);
    doc.transicionarA('CERRADO');
    doc.transicionarA('ENVIADO_A_REVISION');
    doc.transicionarA('OBSERVADO');
    doc.transicionarA('ENVIADO_A_REVISION');
    doc.transicionarA('APROBADO');
    expect(doc.getEstado()).toBe('APROBADO');
  });

  it('rechaza transiciones que se saltan pasos', () => {
    const doc = new Documento('d3', 'c1', 3);
    expect(() => doc.transicionarA('APROBADO')).toThrow(
      'No se puede pasar de BORRADOR a APROBADO',
    );
  });

  it('no permite modificar un documento ya ENVIADO', () => {
    const doc = new Documento('d4', 'c1', 4);
    doc.transicionarA('CERRADO');
    doc.transicionarA('ENVIADO_A_REVISION');
    doc.transicionarA('APROBADO');
    doc.transicionarA('ENVIADO');
    expect(() => doc.transicionarA('CERRADO')).toThrow();
  });
});

const ACTOR = { id: '11111111-1111-4111-8111-111111111111', usuario: 'SUP.UNO', rol: 'SUPERVISOR' };

describe('Documento - historial de transiciones', () => {
  it('registra la creación como transición inicial sin estado anterior', () => {
    const doc = new Documento('d1', 'c1', 1, { tipo: 'INFORME', codigo: 'INFORME-KAL-001-2026' });
    doc.registrarCreacion(ACTOR);
    const pendientes = doc.vaciarTransicionesPendientes();
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: 'BORRADOR', actor: ACTOR, motivo: null });
  });

  it('cada transición queda pendiente con estado anterior, nuevo, actor y motivo', () => {
    const doc = new Documento('d1', 'c1', 1);
    doc.transicionarA('CERRADO', ACTOR);
    doc.transicionarA('ENVIADO_A_REVISION', ACTOR, 'Listo para revisión');
    const pendientes = doc.vaciarTransicionesPendientes();
    expect(pendientes.map((t) => [t.estadoAnterior, t.estadoNuevo, t.motivo])).toEqual([
      ['BORRADOR', 'CERRADO', null],
      ['CERRADO', 'ENVIADO_A_REVISION', 'Listo para revisión'],
    ]);
    expect(doc.vaciarTransicionesPendientes()).toEqual([]);
  });

  it('una transición inválida no deja rastro pendiente', () => {
    const doc = new Documento('d1', 'c1', 1);
    expect(() => doc.transicionarA('APROBADO', ACTOR)).toThrow();
    expect(doc.vaciarTransicionesPendientes()).toEqual([]);
  });

  it('se puede reconstruir en cualquier estado persistido', () => {
    const doc = new Documento('d1', 'c1', 5, { tipo: 'REPORTE', estado: 'APROBADO' });
    expect(doc.getEstado()).toBe('APROBADO');
    expect(doc.tipo).toBe('REPORTE');
    doc.transicionarA('ENVIADO', ACTOR);
    expect(doc.getEstado()).toBe('ENVIADO');
  });
});

describe('construirCodigoDocumento', () => {
  it('informes y reportes usan TIPO-CLIENTE-NNN-AÑO, con el año solo como etiqueta', () => {
    expect(construirCodigoDocumento({ tipo: 'INFORME', codigoCliente: 'KALLPA', numero: 14, anio: 2026 })).toBe('INFORME-KALLPA-014-2026');
    expect(construirCodigoDocumento({ tipo: 'REPORTE', codigoCliente: 'KALLPA', numero: 5, anio: 2027 })).toBe('REPORTE-KALLPA-005-2027');
    expect(construirCodigoDocumento({ tipo: 'INFORME', codigoCliente: 'KALLPA', numero: 1234, anio: 2026 })).toBe('INFORME-KALLPA-1234-2026');
  });

  it('el certificado lleva la secuencia global y no el código del cliente', () => {
    expect(construirCodigoDocumento({ tipo: 'CERTIFICADO', codigoCliente: 'KALLPA', numero: 7, anio: 2026 })).toBe('CERTIFICADO-007-2026');
  });
});
