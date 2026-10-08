import { describe, expect, it } from 'vitest';
import type { DatosEquipo } from './equipo-mapper';
import type { DatosInsumo } from './insumo-mapper';
import { TAMANO_MAXIMO_PDF, claveDePdf, validarEquipo, validarInsumo, validarPdf } from './validaciones';

const insumo: DatosInsumo = {
  nombreComercial: 'Brodifacoum 0.005% bloque',
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: 'DIG-2451-SA',
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  proveedor: '',
  fichaTecnicaKey: 'insumos/ficha-tecnica/a.pdf',
  hojaMsdsKey: 'insumos/hoja-msds/b.pdf',
};

const equipo: DatosEquipo = {
  codigoInterno: 'EQ-022',
  nombre: 'Aspersora de mochila 20L',
  tipo: 'ASPERSION',
  marcaModelo: '',
  fechaAdquisicion: '',
  ultimoMantenimiento: '',
  proximoMantenimiento: '',
};

const pdf = (nombre: string, tipo: string, bytes: number) => new File([new Uint8Array(bytes)], nombre, { type: tipo });

describe('validarInsumo', () => {
  it('acepta un insumo completo; el proveedor es opcional', () => {
    expect(validarInsumo(insumo)).toEqual({});
  });

  it('marca como obligatorios los textos vacíos y las opciones sin elegir', () => {
    const errores = validarInsumo({ ...insumo, nombreComercial: '  ', principioActivo: '', presentacion: '', unidadMedida: '', registroDigesa: '', concentracion: '', dosisEstandar: '' });
    expect(Object.keys(errores).sort()).toEqual(
      ['concentracion', 'dosisEstandar', 'nombreComercial', 'presentacion', 'principioActivo', 'registroDigesa', 'unidadMedida'],
    );
    expect(errores.nombreComercial).toBe('Campo obligatorio.');
  });

  it('avisa si el registro DIGESA ya lo tiene otro insumo del catálogo, sin distinguir mayúsculas ni espacios', () => {
    const errores = validarInsumo({ ...insumo, registroDigesa: ' dig-2451-sa ' }, ['DIG-2451-SA', 'DIG-1']);
    expect(errores.registroDigesa).toBe('Ya existe un insumo con ese registro DIGESA.');
    expect(validarInsumo(insumo, ['DIG-1'])).toEqual({});
  });

  it('exige la ficha técnica y la hoja MSDS en PDF', () => {
    const errores = validarInsumo({ ...insumo, fichaTecnicaKey: '', hojaMsdsKey: '' });
    expect(errores.fichaTecnicaKey).toBe('Cargue la ficha técnica en formato PDF.');
    expect(errores.hojaMsdsKey).toBe('Cargue la hoja MSDS en formato PDF.');
  });
});

describe('validarEquipo', () => {
  it('acepta un equipo con solo los datos obligatorios', () => {
    expect(validarEquipo(equipo)).toEqual({});
  });

  it('marca como obligatorios el código, el nombre y el tipo', () => {
    const errores = validarEquipo({ ...equipo, codigoInterno: '', nombre: ' ', tipo: '' });
    expect(Object.keys(errores).sort()).toEqual(['codigoInterno', 'nombre', 'tipo']);
  });

  it('rechaza una fecha que no existe en el calendario', () => {
    const errores = validarEquipo({ ...equipo, fechaAdquisicion: '2027-02-29' });
    expect(errores.fechaAdquisicion).toMatch(/calendario/);
  });
});

describe('validarPdf', () => {
  it('acepta un PDF de tamaño razonable', () => {
    expect(validarPdf(pdf('ficha.pdf', 'application/pdf', 1024))).toBeNull();
  });

  it('rechaza lo que no es un PDF', () => {
    expect(validarPdf(pdf('foto.png', 'image/png', 1024))).toBe('El archivo debe ser un PDF.');
  });

  it('rechaza un archivo vacío', () => {
    expect(validarPdf(pdf('vacio.pdf', 'application/pdf', 0))).toBe('El archivo está vacío.');
  });

  it('rechaza un PDF mayor al máximo permitido', () => {
    expect(validarPdf(pdf('grande.pdf', 'application/pdf', TAMANO_MAXIMO_PDF + 1))).toBe('El PDF pesa más de 10 MB. Cargue uno más liviano.');
  });
});

describe('claveDePdf', () => {
  it('arma una clave única bajo la carpeta del tipo de anexo', () => {
    const a = claveDePdf('ficha-tecnica');
    expect(a).toMatch(/^insumos\/ficha-tecnica\/[0-9a-f-]{36}\.pdf$/);
    expect(claveDePdf('hoja-msds')).toMatch(/^insumos\/hoja-msds\//);
    expect(claveDePdf('ficha-tecnica')).not.toBe(a);
  });
});
