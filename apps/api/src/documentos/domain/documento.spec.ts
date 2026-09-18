import { Documento } from './documento';

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
