import { describe, expect, it } from 'vitest';
import { CLIENTES_MOCK } from '../../cliente-expediente/model/clientes-mock';
import { tiposContratadosDe, vencimientosDe } from './historial-mock';

describe('vencimientosDe (§3)', () => {
  it('toma la anticipación de alerta de la ficha de cada cliente', () => {
    const kallpa = CLIENTES_MOCK.find((c) => c.codigoCorto === 'KALLPA')!;
    const editado = { ...kallpa, anticipacionAlertaDias: 90 };
    const v = vencimientosDe([editado]);
    expect(v).toEqual([{ cliente: 'KALLPA', fecha: kallpa.proximoVencimiento, tipo: 'DRT', anticipacionDias: 90 }]);
  });

  it('omite clientes inactivos o sin certificado', () => {
    const kallpa = CLIENTES_MOCK.find((c) => c.codigoCorto === 'KALLPA')!;
    expect(vencimientosDe([{ ...kallpa, estado: 'INACTIVO' }, { ...kallpa, proximoVencimiento: null }])).toEqual([]);
  });
});

describe('tiposContratadosDe', () => {
  it('lista los servicios contratados del cliente', () => {
    expect(tiposContratadosDe('KALLPA')).toEqual(['DRT', 'LRA']);
    expect(tiposContratadosDe('NUEVO')).toEqual([]);
  });
});
