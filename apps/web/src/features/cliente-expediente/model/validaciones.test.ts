import { describe, expect, it } from 'vitest';
import {
  normalizarCodigo,
  validarCliente,
  validarProyecto,
  validarServicio,
  type DatosCliente,
  type DatosProyecto,
  type DatosServicio,
} from './validaciones';

const clienteValido: DatosCliente = {
  razonSocial: 'Molinos del Sur S.A.C.',
  ruc: '20611122233',
  codigoCorto: 'MOLISUR',
  direccionFiscal: 'Av. Ejército 101, Yanahuara',
  giro: 'Alimentos',
  contactoNombre: 'Carla Pinto',
  contactoCargo: 'Jefa de Calidad',
  contactoTelefono: '959 123 456',
  contactoCorreo: 'cpinto@molisur.pe',
  estado: 'ACTIVO',
};

const existentes = { codigos: ['KALLPA', 'SAMAY'], rucs: ['20512345678'] };

describe('validarCliente (§7.1)', () => {
  it('acepta un cliente completo', () => {
    expect(validarCliente(clienteValido, existentes)).toEqual({});
  });

  it('exige todos los campos obligatorios', () => {
    const vacio: DatosCliente = {
      ...clienteValido,
      razonSocial: ' ',
      direccionFiscal: '',
      giro: '',
      contactoNombre: '',
      contactoCargo: '',
      contactoTelefono: '',
      contactoCorreo: '',
    };
    const errores = validarCliente(vacio, existentes);
    expect(Object.keys(errores).sort()).toEqual(
      ['contactoCargo', 'contactoCorreo', 'contactoNombre', 'contactoTelefono', 'direccionFiscal', 'giro', 'razonSocial'].sort(),
    );
  });

  it('pide un RUC de 11 dígitos', () => {
    expect(validarCliente({ ...clienteValido, ruc: '2061112223' }, existentes).ruc).toBeDefined();
    expect(validarCliente({ ...clienteValido, ruc: '2061112223A' }, existentes).ruc).toBeDefined();
  });

  it('rechaza el código reservado de personas naturales y lo manda a VARIOS', () => {
    expect(validarCliente({ ...clienteValido, ruc: '12345678910' }, existentes).ruc).toMatch(/VARIOS/);
  });

  it('rechaza un RUC ya registrado', () => {
    expect(validarCliente({ ...clienteValido, ruc: '20512345678' }, existentes).ruc).toBeDefined();
  });

  it('pide un código corto de 4 a 10 mayúsculas o números', () => {
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOL' }, existentes).codigoCorto).toBeDefined();
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOLINOSDELSUR' }, existentes).codigoCorto).toBeDefined();
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOLI_SUR' }, existentes).codigoCorto).toBeDefined();
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOLISUR2' }, existentes).codigoCorto).toBeUndefined();
  });

  it('rechaza un código corto que ya usa otro cliente', () => {
    expect(validarCliente({ ...clienteValido, codigoCorto: 'KALLPA' }, existentes).codigoCorto).toBeDefined();
  });

  it('valida el formato del correo y del teléfono', () => {
    const errores = validarCliente({ ...clienteValido, contactoCorreo: 'cpinto@', contactoTelefono: '12' }, existentes);
    expect(errores.contactoCorreo).toBeDefined();
    expect(errores.contactoTelefono).toBeDefined();
  });
});

describe('normalizarCodigo', () => {
  it('pasa a mayúsculas y quita espacios', () => {
    expect(normalizarCodigo(' moli sur ')).toBe('MOLISUR');
  });
});

const proyectoValido: DatosProyecto = {
  nombre: 'PLANTA_NORTE',
  direccion: 'Parque Industrial Mz. B Lote 2',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  estado: 'ACTIVO',
  observaciones: '',
};

describe('validarProyecto (§7.2)', () => {
  it('acepta una sede completa sin observaciones', () => {
    expect(validarProyecto(proyectoValido, ['CSF_SUNNY'])).toEqual({});
  });

  it('pide un nombre de 4 a 20 mayúsculas sin espacios', () => {
    expect(validarProyecto({ ...proyectoValido, nombre: 'PLA' }, []).nombre).toBeDefined();
    expect(validarProyecto({ ...proyectoValido, nombre: 'PLANTA NORTE' }, []).nombre).toBeDefined();
    expect(validarProyecto({ ...proyectoValido, nombre: 'planta' }, []).nombre).toBeDefined();
    expect(validarProyecto({ ...proyectoValido, nombre: 'PLANTA_NORTE_AMPLIADA' }, []).nombre).toBeDefined();
  });

  it('rechaza una sede repetida dentro del mismo cliente', () => {
    expect(validarProyecto({ ...proyectoValido, nombre: 'CSF_SUNNY' }, ['CSF_SUNNY']).nombre).toBeDefined();
  });

  it('exige ubicación y contacto en la sede', () => {
    const errores = validarProyecto({ ...proyectoValido, distrito: '', contactoNombre: '', contactoTelefono: '' }, []);
    expect(Object.keys(errores).sort()).toEqual(['contactoNombre', 'contactoTelefono', 'distrito']);
  });
});

const servicioValido: DatosServicio = {
  tipo: 'DRT',
  frecuencia: 'Quincenal',
  areaTotal: '1200',
  areaTratar: '800',
  insumos: ['i1'],
  dosis: { i1: '1 bloque por estación' },
  equipos: ['e2'],
  requiereCertificado: true,
  vigenciaDesde: '2026-10-01',
  vigenciaHasta: '2027-03-31',
  observaciones: '',
  estado: 'ACTIVO',
};

describe('validarServicio (§7.3)', () => {
  it('acepta un servicio completo', () => {
    expect(validarServicio(servicioValido)).toEqual({});
  });

  it('exige tipo, frecuencia y si requiere certificado', () => {
    const errores = validarServicio({ ...servicioValido, tipo: '', frecuencia: '', requiereCertificado: null });
    expect(errores.tipo).toBeDefined();
    expect(errores.frecuencia).toBeDefined();
    expect(errores.requiereCertificado).toBeDefined();
  });

  it('no deja que el área a tratar supere el área total', () => {
    expect(validarServicio({ ...servicioValido, areaTratar: '1500' }).areaTratar).toBeDefined();
    expect(validarServicio({ ...servicioValido, areaTotal: '0' }).areaTotal).toBeDefined();
  });

  it('pide al menos un insumo y un equipo', () => {
    const errores = validarServicio({ ...servicioValido, insumos: [], dosis: {}, equipos: [] });
    expect(errores.insumos).toBeDefined();
    expect(errores.equipos).toBeDefined();
  });

  it('pide la dosis de cada insumo elegido', () => {
    expect(validarServicio({ ...servicioValido, insumos: ['i1', 'i3'], dosis: { i1: '1 bloque' } }).dosis).toBeDefined();
  });

  it('con certificado, pide un período de vigencia válido', () => {
    expect(validarServicio({ ...servicioValido, vigenciaHasta: '' }).vigenciaHasta).toBeDefined();
    expect(validarServicio({ ...servicioValido, vigenciaHasta: '2026-09-01' }).vigenciaHasta).toBeDefined();
  });

  it('sin certificado, no pide vigencia', () => {
    expect(validarServicio({ ...servicioValido, requiereCertificado: false, vigenciaDesde: '', vigenciaHasta: '' })).toEqual({});
  });
});
