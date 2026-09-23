import { describe, expect, it } from 'vitest';
import {
  MAX_FOTOS_PDF,
  anexosAutomaticos,
  aprobar,
  fotosDisponibles,
  intervenir,
  marcarEnviado,
  modificarAprobado,
  observar,
  puedeDecidir,
  puedeIntervenir,
  puedeModificarAprobado,
  seleccionInicialFotos,
  validarSeleccionFotos,
} from './flujo-documento';
import type { DocumentoDetalle } from './tipos';
import type { Insumo } from '../../mantenimiento/model/tipos';

const insumos: Insumo[] = [
  { id: 'i1', nombre: 'Brodifacoum 0.005% bloque parafinado', principioActivo: 'Brodifacoum', presentacion: 'Bloque', concentracion: '0.005%', registroDigesa: 'DIG-2451-SA', dosisReferencial: '1 bloque', estado: 'ACTIVO' },
  { id: 'i2', nombre: 'Cipermetrina 25% EC', principioActivo: 'Cipermetrina', presentacion: 'Líquido', concentracion: '25%', registroDigesa: 'DIG-1980-SA', dosisReferencial: '10 ml/L', estado: 'ACTIVO' },
];

const doc: DocumentoDetalle = {
  id: 'd1',
  codigo: 'INFORME-KALLPA-014-2026',
  cliente: 'KALLPA',
  proyecto: 'PLANTA',
  tipo: 'INFORME',
  estado: 'ENVIADO_A_REVISION',
  fecha: '2026-09-15',
  diagnostico: 'Presencia moderada de roedores.',
  trabajosRealizados: 'Desratización perimetral.',
  insumosUsados: [
    { producto: 'Brodifacoum 0.005% bloque', lote: 'L-2451', cantidad: '600 g', concentracion: '0.005%' },
    { producto: 'Cipermetrina 25% EC', lote: 'L-2298', cantidad: '2 L', concentracion: '10 ml/L' },
  ],
  personal: [{ nombre: 'Marco Ipusari', cargo: 'Técnico Operador' }],
  accionesCorrectivas: [],
  observaciones: 'Acceso restringido a tanques.',
  recomendaciones: 'Retirar cartones.',
  fotos: 26,
  numeroCertificado: 'CERT-KALLPA-014-2026',
  vencimientoCertificado: '2026-12-15',
  firmaCliente: 'Rosa Contreras — Jefa de Planta',
};

const director = { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: 'data:image/png;base64,xyz' };
const ctx = { usuario: 'd.amamani', rol: 'SUPERVISOR' as const, fechaHora: '2026-09-23 10:00' };

describe('permisos del flujo (§8.3 con decisiones C2, C3, C4)', () => {
  it('Administrador y Supervisor deciden sobre documentos en revisión', () => {
    expect(puedeDecidir('ENVIADO_A_REVISION')).toBe(true);
    expect(puedeDecidir('APROBADO')).toBe(false);
  });

  it('se interviene con clave un documento cerrado en revisión u observado', () => {
    expect(puedeIntervenir('ENVIADO_A_REVISION')).toBe(true);
    expect(puedeIntervenir('OBSERVADO')).toBe(true);
    expect(puedeIntervenir('APROBADO')).toBe(false);
  });

  it('solo el Administrador modifica un documento aprobado', () => {
    expect(puedeModificarAprobado('ADMINISTRADOR', 'APROBADO')).toBe(true);
    expect(puedeModificarAprobado('SUPERVISOR', 'APROBADO')).toBe(false);
    expect(puedeModificarAprobado('ADMINISTRADOR', 'ENVIADO')).toBe(false);
  });
});

describe('fotos del PDF (C9, C15)', () => {
  it('solo se eligen fotos que ya llegaron del celular', () => {
    expect(fotosDisponibles({ ...doc, fotos: 8, fotosRecibidas: 5 })).toBe(5);
    expect(fotosDisponibles({ ...doc, fotos: 8 })).toBe(8);
  });

  it('preselecciona hasta 20', () => {
    expect(seleccionInicialFotos(doc)).toHaveLength(MAX_FOTOS_PDF);
    expect(seleccionInicialFotos({ ...doc, fotos: 8, fotosRecibidas: 5 })).toEqual([0, 1, 2, 3, 4]);
  });

  it('rechaza más de 20 fotos', () => {
    expect(validarSeleccionFotos(Array.from({ length: 21 }, (_, i) => i))).not.toBeNull();
    expect(validarSeleccionFotos([0, 1])).toBeNull();
  });
});

describe('anexosAutomaticos (C14)', () => {
  it('adjunta ficha técnica y MSDS de los insumos consumidos, más la licencia de GAFER', () => {
    expect(anexosAutomaticos(doc, insumos)).toEqual([
      'Ficha técnica — Brodifacoum 0.005% bloque parafinado',
      'MSDS — Brodifacoum 0.005% bloque parafinado',
      'Ficha técnica — Cipermetrina 25% EC',
      'MSDS — Cipermetrina 25% EC',
      'Resolución de licencia sanitaria de GAFER',
    ]);
  });
});

describe('aprobar', () => {
  it('aprueba, estampa la firma del Director Técnico y genera Informe y Certificado aparte (C7, C13)', () => {
    const { documento, evento } = aprobar(doc, { ...ctx, fotosSeleccionadas: [0, 1, 2], insumos, director });
    expect(documento.estado).toBe('APROBADO');
    expect(documento.fotosSeleccionadas).toEqual([0, 1, 2]);
    expect(documento.firmaDirector).toBe('Ing. Carlos Medina Ruiz · CIP 84512');
    expect(documento.generados).toEqual(['INFORME-KALLPA-014-2026.pdf', 'CERT-KALLPA-014-2026.pdf']);
    expect(documento.anexos).toHaveLength(5);
    expect(evento).toMatchObject({ usuario: 'd.amamani', rol: 'SUPERVISOR', accion: 'Aprobación', referencia: 'INFORME-KALLPA-014-2026' });
  });

  it('sin certificado genera un solo PDF', () => {
    const { documento } = aprobar({ ...doc, numeroCertificado: '—' }, { ...ctx, fotosSeleccionadas: [], insumos, director });
    expect(documento.generados).toEqual(['INFORME-KALLPA-014-2026.pdf']);
  });

  it('no aprueba sin Director Técnico configurado ni con más de 20 fotos', () => {
    expect(() => aprobar(doc, { ...ctx, fotosSeleccionadas: [], insumos, director: null })).toThrow();
    expect(() => aprobar(doc, { ...ctx, fotosSeleccionadas: Array.from({ length: 21 }, (_, i) => i), insumos, director })).toThrow();
  });

  it('no aprueba un documento que no está en revisión', () => {
    expect(() => aprobar({ ...doc, estado: 'OBSERVADO' }, { ...ctx, fotosSeleccionadas: [], insumos, director })).toThrow();
  });
});

describe('observar', () => {
  it('devuelve el documento con el comentario y lo registra', () => {
    const { documento, evento } = observar(doc, { ...ctx, comentario: 'Falta foto de estación 09.' });
    expect(documento.estado).toBe('OBSERVADO');
    expect(documento.comentarioObservacion).toBe('Falta foto de estación 09.');
    expect(evento.accion).toBe('Observación');
  });
});

describe('intervenir con clave (C3)', () => {
  it('registra cada campo cambiado con valor anterior y nuevo', () => {
    const { documento, eventos } = intervenir(doc, { observaciones: 'Acceso habilitado.' }, ctx);
    expect(documento.observaciones).toBe('Acceso habilitado.');
    expect(documento.estado).toBe('ENVIADO_A_REVISION');
    expect(eventos).toEqual([
      expect.objectContaining({
        accion: 'Intervención post-cierre',
        campo: 'Observaciones',
        valorAnterior: 'Acceso restringido a tanques.',
        valorNuevo: 'Acceso habilitado.',
      }),
    ]);
  });

  it('corregir un documento observado lo devuelve a revisión', () => {
    const { documento } = intervenir({ ...doc, estado: 'OBSERVADO' }, { diagnostico: 'Actualizado.' }, ctx);
    expect(documento.estado).toBe('ENVIADO_A_REVISION');
  });

  it('no registra nada si no hubo cambios', () => {
    expect(() => intervenir(doc, { observaciones: doc.observaciones }, ctx)).toThrow();
  });
});

describe('modificarAprobado (C4)', () => {
  const aprobado: DocumentoDetalle = { ...doc, estado: 'APROBADO' };
  const admin = { usuario: 'r.agarate', rol: 'ADMINISTRADOR' as const, fechaHora: '2026-09-23 11:00' };

  it('el Administrador modifica en un paso y queda como quien autorizó y ejecutó', () => {
    const { documento, eventos } = modificarAprobado(aprobado, { recomendaciones: 'Reparar tuberías.' }, { ...admin, motivo: 'Solicitud del cliente' });
    expect(documento.recomendaciones).toBe('Reparar tuberías.');
    expect(documento.estado).toBe('APROBADO');
    expect(eventos[0]).toMatchObject({
      accion: 'Modificación post-aprobación',
      autorizo: 'r.agarate',
      ejecuto: 'r.agarate',
      detalle: 'Motivo: Solicitud del cliente',
      valorAnterior: 'Retirar cartones.',
      valorNuevo: 'Reparar tuberías.',
    });
  });

  it('exige motivo y rechaza al Supervisor', () => {
    expect(() => modificarAprobado(aprobado, { recomendaciones: 'x' }, { ...admin, motivo: '' })).toThrow();
    expect(() => modificarAprobado(aprobado, { recomendaciones: 'x' }, { ...ctx, motivo: 'Solicitud del cliente' })).toThrow();
  });
});

describe('marcarEnviado (§8.3, §9)', () => {
  it('pasa un documento aprobado a enviado al cliente', () => {
    const { documento, evento } = marcarEnviado({ ...doc, estado: 'APROBADO' }, ctx);
    expect(documento.estado).toBe('ENVIADO');
    expect(evento.accion).toBe('Envío al cliente');
  });
});
