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

describe('validarCliente (§7.1)', () => {
  it('acepta un cliente completo', () => {
    expect(validarCliente(clienteValido)).toEqual({});
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
    const errores = validarCliente(vacio);
    expect(Object.keys(errores).sort()).toEqual(
      ['contactoCargo', 'contactoCorreo', 'contactoNombre', 'contactoTelefono', 'direccionFiscal', 'giro', 'razonSocial'].sort(),
    );
  });

  it('pide un RUC de 11 dígitos', () => {
    expect(validarCliente({ ...clienteValido, ruc: '2061112223' }).ruc).toBeDefined();
    expect(validarCliente({ ...clienteValido, ruc: '2061112223A' }).ruc).toBeDefined();
  });

  it('rechaza el código reservado de personas naturales y lo manda a VARIOS', () => {
    expect(validarCliente({ ...clienteValido, ruc: '12345678910' }).ruc).toMatch(/VARIOS/);
  });

  it('pide un código corto de 4 a 10 mayúsculas o números', () => {
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOL' }).codigoCorto).toBeDefined();
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOLINOSDELSUR' }).codigoCorto).toBeDefined();
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOLI_SUR' }).codigoCorto).toBeDefined();
    expect(validarCliente({ ...clienteValido, codigoCorto: 'MOLISUR2' }).codigoCorto).toBeUndefined();
  });

  it('valida el formato del correo y del teléfono', () => {
    const errores = validarCliente({ ...clienteValido, contactoCorreo: 'cpinto@', contactoTelefono: '12' });
    expect(errores.contactoCorreo).toBeDefined();
    expect(errores.contactoTelefono).toBeDefined();
  });

  it('usa los mensajes en español del esquema compartido y "obligatorio" para los vacíos', () => {
    const errores = validarCliente({ ...clienteValido, ruc: '123', razonSocial: '', contactoCorreo: 'cpinto@' });
    expect(errores.ruc).toBe('El RUC tiene 11 dígitos, sin letras ni espacios');
    expect(errores.razonSocial).toBe('Campo obligatorio.');
    expect(errores.contactoCorreo).toMatch(/correo válido/);
  });

  it('en edición no exige ni valida el RUC y el código corto, que no cambian', () => {
    const errores = validarCliente({ ...clienteValido, ruc: '', codigoCorto: '' }, { edicion: true });
    expect(errores).toEqual({});
  });

  it('en edición sigue exigiendo el resto de la ficha', () => {
    const errores = validarCliente({ ...clienteValido, razonSocial: ' ', contactoCorreo: 'x' }, { edicion: true });
    expect(Object.keys(errores).sort()).toEqual(['contactoCorreo', 'razonSocial']);
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
    expect(errores.distrito).toBe('Campo obligatorio.');
  });

  it('muestra el mensaje del esquema cuando el teléfono no es válido', () => {
    expect(validarProyecto({ ...proyectoValido, contactoTelefono: 'abc' }, []).contactoTelefono).toBe(
      'El teléfono solo admite dígitos y + ( ) -',
    );
  });

  it('en edición admite los nombres de 3 a 50 caracteres que guarda la base', () => {
    expect(validarProyecto({ ...proyectoValido, nombre: 'ABC' }, [], { edicion: true })).toEqual({});
    expect(validarProyecto({ ...proyectoValido, nombre: 'AB' }, [], { edicion: true }).nombre).toBeDefined();
  });
});

const servicioValido: DatosServicio = {
  tipo: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotal: '1200',
  areaTratar: '800',
  insumos: ['i1'],
  dosis: { i1: '1 bloque por estación' },
  equipos: ['e2'],
  requiereCertificado: true,
  vigenciaDias: '180',
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

  it('no deja que el área a tratar supere el área total (regla cruzada del esquema, en el campo del área a tratar)', () => {
    const errores = validarServicio({ ...servicioValido, areaTratar: '1500' });
    expect(errores.areaTratar).toBe('No puede superar el área total del local');
    expect(errores.areaTotal).toBeUndefined();
  });

  it('pide superficies mayores a 0', () => {
    expect(validarServicio({ ...servicioValido, areaTotal: '0' }).areaTotal).toBe('Ingrese una superficie mayor a 0 m².');
    expect(validarServicio({ ...servicioValido, areaTratar: '', areaTotal: '' })).toMatchObject({
      areaTotal: 'Campo obligatorio.',
      areaTratar: 'Campo obligatorio.',
    });
  });

  it('pide al menos un insumo y un equipo', () => {
    const errores = validarServicio({ ...servicioValido, insumos: [], dosis: {}, equipos: [] });
    expect(errores.insumos).toBeDefined();
    expect(errores.equipos).toBeDefined();
  });

  it('pide la dosis de cada insumo elegido', () => {
    expect(validarServicio({ ...servicioValido, insumos: ['i1', 'i3'], dosis: { i1: '1 bloque' } }).dosis).toBeDefined();
  });

  it('con certificado, pide la vigencia en días (entero mayor a 0)', () => {
    expect(validarServicio({ ...servicioValido, vigenciaDias: '' }).vigenciaDias).toBe('Campo obligatorio.');
    expect(validarServicio({ ...servicioValido, vigenciaDias: '0' }).vigenciaDias).toBe('Ingrese un número entero de días mayor a 0.');
    expect(validarServicio({ ...servicioValido, vigenciaDias: '12.5' }).vigenciaDias).toBe('Ingrese un número entero de días mayor a 0.');
  });

  it('sin certificado, no pide vigencia', () => {
    expect(validarServicio({ ...servicioValido, requiereCertificado: false, vigenciaDias: '' })).toEqual({});
  });
});
