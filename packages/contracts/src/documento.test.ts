import { describe, expect, it } from 'vitest';
import { DocumentoDetalleSchema, DocumentoResumenSchema, DocumentoSchema, EstadoDocumentoSchema } from './documento';
import { esperarFallaEn } from './pruebas';

describe('DocumentoSchema (contrato original)', () => {
  it('sigue aceptando la forma original', () => {
    const ok = DocumentoSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      clienteId: '22222222-2222-2222-2222-222222222222',
      tipo: 'INFORME',
      numeroCorrelativo: 3,
      estado: 'BORRADOR',
    });
    expect(ok.success).toBe(true);
  });
  it('los seis estados del flujo siguen vigentes', () => expect(EstadoDocumentoSchema.options).toHaveLength(6));
});

const resumen = {
  id: 'd1',
  codigo: 'INF-2026-0001',
  cliente: 'KALLPA',
  proyecto: 'PLANTA_SUR',
  tipo: 'INFORME',
  estado: 'ENVIADO_A_REVISION',
  fecha: '2026-09-20',
};

describe('DocumentoResumenSchema (bandeja de aprobación)', () => {
  it('acepta un resumen válido', () => expect(DocumentoResumenSchema.safeParse(resumen).success).toBe(true));
  it('rechaza tipo, estado y fecha inválidos por su campo', () => {
    esperarFallaEn(DocumentoResumenSchema, { ...resumen, tipo: 'ACTA' }, 'tipo');
    esperarFallaEn(DocumentoResumenSchema, { ...resumen, estado: 'PENDIENTE' }, 'estado');
    esperarFallaEn(DocumentoResumenSchema, { ...resumen, fecha: '20/09/2026' }, 'fecha');
  });
});

const detalle = {
  ...resumen,
  diagnostico: 'Actividad de roedores en almacén',
  trabajosRealizados: 'Reposición de cebos',
  insumosUsados: [{ producto: 'Klerat', lote: 'L-1', cantidad: '200 g', concentracion: '0.005%' }],
  personal: [{ nombre: 'Luis Quispe', cargo: 'Técnico Operador' }],
  accionesCorrectivas: ['Sellar ingresos'],
  observaciones: '',
  recomendaciones: 'Mantener orden',
  fotos: 4,
  numeroCertificado: 'CERT-001',
  vencimientoCertificado: '2027-03-20',
  firmaCliente: 'Carlos Ramos',
};

describe('DocumentoDetalleSchema', () => {
  it('acepta un detalle sin campos opcionales de revisión y aprobación', () => expect(DocumentoDetalleSchema.safeParse(detalle).success).toBe(true));
  it('acepta los campos opcionales de sincronización, observación y aprobación (C7, C13, C14, C15)', () => {
    const completo = {
      ...detalle,
      fotosRecibidas: 3,
      fotosSeleccionadas: [0, 2],
      comentarioObservacion: 'Corregir lote',
      firmaDirector: 'Ing. Salas',
      generados: ['informe.pdf'],
      anexos: ['ficha.pdf'],
    };
    expect(DocumentoDetalleSchema.safeParse(completo).success).toBe(true);
  });
  it('rechaza número de fotos negativo o fraccionario', () => {
    esperarFallaEn(DocumentoDetalleSchema, { ...detalle, fotos: -1 }, 'fotos');
    esperarFallaEn(DocumentoDetalleSchema, { ...detalle, fotos: 1.5 }, 'fotos');
  });
  it('rechaza un insumo usado sin lote', () => {
    esperarFallaEn(DocumentoDetalleSchema, { ...detalle, insumosUsados: [{ producto: 'K', cantidad: '1', concentracion: '1' }] }, 'insumosUsados.0.lote');
  });
});
