import { describe, expect, it } from 'vitest';
import {
  aDocumento,
  cerrarFormulario,
  crearFormulario,
  personalDeUsuario,
  registrarGuardado,
  tipoDocumentoDe,
  validarCierre,
  type FormularioCampo,
} from './formulario-campo';
import type { ServicioContratado } from '../../cliente-expediente/model/expediente-mock';
import type { Insumo, PersonalOperativo } from '../../mantenimiento/model/tipos';

const servicio: ServicioContratado = {
  id: 's1',
  tipoId: 'DRT',
  tipo: 'DRT — Desratización',
  frecuencia: 'Quincenal',
  requiereCertificado: true,
  insumos: ['i1'],
  dosis: { i1: '1 bloque por estación' },
  equipos: ['e2'],
};

const insumos: Insumo[] = [
  {
    id: 'i1',
    nombre: 'Brodifacoum 0.005% bloque',
    principioActivo: 'Brodifacoum',
    presentacion: 'Bloque',
    concentracion: '0.005%',
    registroDigesa: 'DIG-2451-SA',
    dosisReferencial: '1 bloque por estación',
    estado: 'ACTIVO',
  },
];

const personal: PersonalOperativo[] = [
  { id: 'p2', nombre: 'Marco Ipusari', dni: '47210345', cargo: 'Técnico Operador', estado: 'ACTIVO' },
  { id: 'p4', nombre: 'Rosa Agárate', dni: '44982315', cargo: 'Administrador', estado: 'ACTIVO' },
];

function base(): FormularioCampo {
  return crearFormulario({
    cliente: { id: 'c1', codigoCorto: 'KALLPA', razonSocial: 'Kallpa Energía S.A.' },
    proyecto: { id: 'p1', nombre: 'CSF_SUNNY' },
    servicio,
    fecha: '2026-09-23',
    hora: '08:00',
    personalInicial: ['p2'],
  });
}

function completo(): FormularioCampo {
  return {
    ...base(),
    metodos: ['Cebado'],
    insumos: [{ insumoId: 'i1', aplicado: true, lote: 'L-2451', vencimiento: '2027-05-01', cantidad: '600', unidad: 'g', zonas: 'Perímetro y almacén' }],
    temperatura: '21',
    humedad: '38',
    viento: '8',
    estadoGeneral: 'Regular',
    nivelInfestacion: 'Bajo',
    firma: 'data:image/png;base64,xyz',
    firmanteNombre: 'Rosa Contreras',
    firmanteCargo: 'Jefa de Planta',
    certificadoNumero: 'CERT-KALLPA-015-2026',
    certificadoEmision: '2026-09-23',
    certificadoVencimiento: '2026-12-23',
  };
}

describe('crearFormulario (§8.2, precarga)', () => {
  it('precarga identificación, equipos e insumos autorizados del servicio', () => {
    const f = base();
    expect(f.estado).toBe('BORRADOR');
    expect(f.tipoServicio).toBe('DRT');
    expect(f.equipos).toEqual(['e2']);
    expect(f.insumos.map((i) => i.insumoId)).toEqual(['i1']);
    expect(f.personal).toEqual(['p2']);
    expect(f.guardados).toEqual([]);
  });
});

describe('validarCierre (§4, §8.2)', () => {
  it('permite cerrar un formulario completo', () => {
    expect(validarCierre(completo())).toEqual({});
  });

  it('bloquea el cierre de un formulario recién abierto y dice qué falta', () => {
    const errores = validarCierre(base());
    expect(errores.metodos).toBeDefined();
    expect(errores.insumos).toBeDefined();
    expect(errores.condiciones).toBeDefined();
    expect(errores.diagnostico).toBeDefined();
    expect(errores.conformidad).toBeDefined();
    expect(errores.certificado).toBeDefined();
  });

  it('exige personal y equipos', () => {
    const errores = validarCierre({ ...completo(), personal: [], equipos: [] });
    expect(errores.personal).toBeDefined();
    expect(errores.equipos).toBeDefined();
  });

  it('exige lote, vencimiento, cantidad y zonas de cada insumo aplicado', () => {
    const f = completo();
    expect(validarCierre({ ...f, insumos: [{ ...f.insumos[0], lote: '' }] }).insumos).toBeDefined();
    expect(validarCierre({ ...f, insumos: [{ ...f.insumos[0], aplicado: false }] }).insumos).toBeDefined();
  });

  it('rechaza una humedad fuera de 0 a 100 %', () => {
    expect(validarCierre({ ...completo(), humedad: '130' }).condiciones).toBeDefined();
  });

  it('acepta "responsable no disponible" en lugar de la firma', () => {
    const f = { ...completo(), firma: null, firmanteNombre: '', firmanteCargo: '', responsableNoDisponible: true };
    expect(validarCierre(f).conformidad).toBeUndefined();
  });

  it('pide nombre y cargo junto con la firma', () => {
    expect(validarCierre({ ...completo(), firmanteCargo: '' }).conformidad).toBeDefined();
  });

  it('no pide certificado si el servicio no lo requiere', () => {
    const f = { ...completo(), requiereCertificado: false, certificadoNumero: '', certificadoEmision: '', certificadoVencimiento: '' };
    expect(validarCierre(f).certificado).toBeUndefined();
  });
});

describe('guardado parcial y cierre (§8.2, §8.3, §8.4)', () => {
  it('cada guardado parcial queda con usuario, fecha y hora y sigue en BORRADOR', () => {
    const f = registrarGuardado(base(), 'm.ipusari', '2026-09-23 08:41');
    expect(f.estado).toBe('BORRADOR');
    expect(f.guardados).toEqual([{ usuario: 'm.ipusari', fechaHora: '2026-09-23 08:41', accion: 'Guardado parcial' }]);
  });

  it('el cierre registra quién cerró y lo envía a revisión', () => {
    const f = cerrarFormulario(completo(), 'm.ipusari', '2026-09-23 09:15');
    expect(f.estado).toBe('ENVIADO_A_REVISION');
    expect(f.guardados.map((g) => g.accion)).toEqual(['Cierre de inspección', 'Enviado a revisión']);
  });

  it('no cierra un formulario incompleto', () => {
    expect(() => cerrarFormulario(base(), 'm.ipusari', '2026-09-23 09:15')).toThrow();
  });
});

describe('tipoDocumentoDe (§2)', () => {
  it('desratización genera Reporte; el resto, Informe', () => {
    expect(tipoDocumentoDe('DRT')).toBe('REPORTE');
    expect(tipoDocumentoDe('DSF')).toBe('INFORME');
  });
});

describe('aDocumento', () => {
  it('arma el documento para la bandeja, sin correlativo hasta aprobar (§2)', () => {
    const doc = aDocumento({ ...completo(), estado: 'ENVIADO_A_REVISION' }, { personal, insumos });
    expect(doc.codigo).toBe('REPORTE-KALLPA-S/N-2026');
    expect(doc.estado).toBe('ENVIADO_A_REVISION');
    expect(doc.personal).toEqual([{ nombre: 'Marco Ipusari', cargo: 'Técnico Operador' }]);
    expect(doc.insumosUsados).toEqual([{ producto: 'Brodifacoum 0.005% bloque', lote: 'L-2451', cantidad: '600 g', concentracion: '0.005%' }]);
    expect(doc.firmaCliente).toBe('Rosa Contreras — Jefa de Planta');
    expect(doc.numeroCertificado).toBe('CERT-KALLPA-015-2026');
  });

  it('deja constancia cuando el responsable no estuvo disponible', () => {
    const doc = aDocumento({ ...completo(), responsableNoDisponible: true, firma: null }, { personal, insumos });
    expect(doc.firmaCliente).toBe('Responsable no disponible al momento del servicio');
  });
});

describe('personalDeUsuario', () => {
  it('reconoce al técnico por su usuario de sistema, ignorando tildes', () => {
    expect(personalDeUsuario('m.ipusari', personal)?.id).toBe('p2');
    expect(personalDeUsuario('r.agarate', personal)?.id).toBe('p4');
    expect(personalDeUsuario('x.nadie', personal)).toBeUndefined();
  });
});
