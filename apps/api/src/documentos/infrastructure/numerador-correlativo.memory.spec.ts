import { NumeradorCorrelativoMemory } from './numerador-correlativo.memory';

describe('NumeradorCorrelativoMemory', () => {
  it('numera por cliente y tipo y nunca reinicia', async () => {
    const n = new NumeradorCorrelativoMemory();
    expect(await n.siguienteNumero('c1', 'INFORME')).toBe(1);
    expect(await n.siguienteNumero('c1', 'INFORME')).toBe(2);
    expect(await n.siguienteNumero('c1', 'REPORTE')).toBe(1);
    expect(await n.siguienteNumero('c2', 'INFORME')).toBe(1);
  });

  it('el certificado es una única secuencia global', async () => {
    const n = new NumeradorCorrelativoMemory();
    expect(await n.siguienteNumero('c1', 'CERTIFICADO')).toBe(1);
    expect(await n.siguienteNumero('c2', 'CERTIFICADO')).toBe(2);
  });
});
