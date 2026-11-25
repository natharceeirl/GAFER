import { describe, expect, it } from 'vitest';
import { detalleDeApi, etiquetaPdf, filaDeApi, puedeGestionarPdf, type DocumentoDetalleApi, type DocumentoResumenApi } from './documento-mapper';

const resumen: DocumentoResumenApi = {
  id: 'd1111111-1111-4111-8111-111111111111',
  codigo: 'INFORME-KALLPA-014-2026',
  clienteId: 'a1111111-1111-4111-8111-111111111111',
  cliente: 'Kallpa Generación S.A.',
  proyecto: 'Planta Chilca',
  tipo: 'INFORME',
  numeroCorrelativo: 14,
  estado: 'ENVIADO_A_REVISION',
  fecha: '2026-11-24',
};

describe('filaDeApi', () => {
  it('conserva los datos legibles de la bandeja', () => {
    expect(filaDeApi(resumen)).toEqual({
      id: resumen.id,
      codigo: resumen.codigo,
      cliente: 'Kallpa Generación S.A.',
      proyecto: 'Planta Chilca',
      tipo: 'INFORME',
      estado: 'ENVIADO_A_REVISION',
      fecha: '2026-11-24',
    });
  });

  it('un documento sin sede muestra un texto neutro en lugar de null', () => {
    expect(filaDeApi({ ...resumen, proyecto: null }).proyecto).toBe('Sin sede');
  });

  it('acepta el tipo CERTIFICADO que devuelve el API', () => {
    expect(filaDeApi({ ...resumen, tipo: 'CERTIFICADO' }).tipo).toBe('CERTIFICADO');
  });
});

describe('detalleDeApi', () => {
  const detalle: DocumentoDetalleApi = {
    ...resumen,
    transiciones: [
      { estadoAnterior: null, estadoNuevo: 'BORRADOR', actorId: null, actorUsuario: 'TEC.UNO', actorRol: 'TECNICO_OPERADOR', motivo: null, fecha: '2026-11-24T15:00:00.000Z' },
      { estadoAnterior: 'BORRADOR', estadoNuevo: 'CERRADO', actorId: 'x', actorUsuario: 'TEC.UNO', actorRol: 'TECNICO_OPERADOR', motivo: 'Listo', fecha: '2026-11-24T16:00:00.000Z' },
    ],
    pdf: { estado: null, generadoAt: null, error: null },
  };

  it('agrega la fila y traduce el historial', () => {
    const r = detalleDeApi(detalle);
    expect(r.fila.codigo).toBe(resumen.codigo);
    expect(r.historial).toHaveLength(2);
    expect(r.historial[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: 'BORRADOR', usuario: 'TEC.UNO', rol: 'Técnico Operador', motivo: null });
    expect(r.historial[1]).toMatchObject({ estadoAnterior: 'BORRADOR', motivo: 'Listo' });
    expect(r.pdf).toEqual({ estado: null, generadoAt: null, error: null });
  });

  it('un rol desconocido se muestra tal cual', () => {
    const r = detalleDeApi({ ...detalle, transiciones: [{ ...detalle.transiciones[0], actorRol: 'OTRO' }] });
    expect(r.historial[0].rol).toBe('OTRO');
  });
});

describe('etiquetaPdf', () => {
  it.each([
    [null, 'Sin generar'],
    ['PENDIENTE', 'Pendiente'],
    ['GENERANDO', 'Generando'],
    ['GENERADO', 'Generado'],
    ['ERROR', 'Con error'],
  ] as const)('%s -> %s', (estado, texto) => {
    expect(etiquetaPdf(estado)).toBe(texto);
  });
});

describe('puedeGestionarPdf', () => {
  it('solo Administrador y Supervisor', () => {
    expect(puedeGestionarPdf('ADMINISTRADOR')).toBe(true);
    expect(puedeGestionarPdf('SUPERVISOR')).toBe(true);
    expect(puedeGestionarPdf('TECNICO_OPERADOR')).toBe(false);
  });
});
