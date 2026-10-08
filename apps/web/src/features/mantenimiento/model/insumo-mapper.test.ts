import { describe, expect, it } from 'vitest';
import { InsumoActualizacionSchema, InsumoRegistroSchema, type Insumo } from '@gafer/contracts';
import { ErrorApi } from '../../../shared/api/errores';
import { actualizacionDeInsumo, camposDeErrorInsumo, campoDeRutaInsumo, datosDeInsumo, registroDeInsumo, type DatosInsumo } from './insumo-mapper';

const insumo: Insumo = {
  id: '11111111-1111-4111-8111-111111111111',
  nombreComercial: 'Brodifacoum 0.005% bloque',
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: 'DIG-2451-SA',
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  fichaTecnicaKey: 'insumos/ficha-tecnica/a.pdf',
  hojaMsdsKey: 'insumos/hoja-msds/b.pdf',
  resolucionKey: null,
  proveedor: null,
  estado: 'ACTIVO',
};

const datos: DatosInsumo = {
  nombreComercial: '  Brodifacoum 0.005% bloque ',
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

describe('insumo-mapper', () => {
  it('lleva el insumo del API a los datos del formulario (proveedor nulo es texto vacío)', () => {
    expect(datosDeInsumo(insumo)).toEqual({ ...datos, nombreComercial: 'Brodifacoum 0.005% bloque' });
  });

  it('arma un cuerpo de alta que cumple el esquema compartido, sin espacios sobrantes y con proveedor nulo si está vacío', () => {
    const cuerpo = registroDeInsumo(datos);
    expect(cuerpo.nombreComercial).toBe('Brodifacoum 0.005% bloque');
    expect(cuerpo.proveedor).toBeNull();
    expect(InsumoRegistroSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('manda el proveedor cuando se indica', () => {
    expect(registroDeInsumo({ ...datos, proveedor: ' Bayer ' }).proveedor).toBe('Bayer');
  });

  it('arma un cuerpo de edición que cumple el esquema de actualización', () => {
    expect(InsumoActualizacionSchema.safeParse(actualizacionDeInsumo(datos)).success).toBe(true);
  });

  it('traduce las rutas del API a campos del formulario', () => {
    expect(campoDeRutaInsumo('registroDigesa')).toBe('registroDigesa');
    expect(campoDeRutaInsumo('fichaTecnicaKey')).toBe('fichaTecnicaKey');
    expect(campoDeRutaInsumo('estado')).toBeNull();
  });

  it('reparte un 400 por campo', () => {
    const error = new ErrorApi({ tipo: 'validacion', mensaje: 'Los datos enviados no son válidos.', campos: { concentracion: 'Requerido' } });
    expect(camposDeErrorInsumo(error).campos).toEqual({ concentracion: 'Requerido' });
  });

  it('un 409 por registro DIGESA repetido marca ese campo', () => {
    const error = new ErrorApi({ tipo: 'conflicto', mensaje: 'Ya existe un insumo registrado con el código DIGESA: DIG-1' });
    const { campos, general } = camposDeErrorInsumo(error);
    expect(campos.registroDigesa).toMatch(/registro DIGESA/i);
    expect(general).toBeNull();
  });
});
