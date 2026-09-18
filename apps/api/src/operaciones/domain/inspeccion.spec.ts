import { Inspeccion } from './inspeccion';

describe('Inspeccion', () => {
  it('arranca en BORRADOR', () => {
    const inspeccion = new Inspeccion('i1', 's1');
    expect(inspeccion.getEstado()).toBe('BORRADOR');
  });

  it('pasa a CERRADO al cerrar', () => {
    const inspeccion = new Inspeccion('i1', 's1');
    inspeccion.cerrar();
    expect(inspeccion.getEstado()).toBe('CERRADO');
  });

  it('no permite cerrar una inspección ya cerrada', () => {
    const inspeccion = new Inspeccion('i1', 's1');
    inspeccion.cerrar();
    expect(() => inspeccion.cerrar()).toThrow('La inspección ya está cerrada');
  });
});
