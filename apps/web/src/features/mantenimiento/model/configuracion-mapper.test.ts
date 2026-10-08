import { describe, expect, it } from 'vitest';
import { ConfiguracionSistemaActualizacionSchema, type ConfiguracionSistema } from '@gafer/contracts';
import { ErrorApi } from '../../../shared/api/errores';
import { actualizacionDeConfiguracion, camposDeErrorConfiguracion, datosDeConfiguracion, directorDeConfiguracion, type DatosConfiguracion } from './configuracion-mapper';
import { TAMANO_MAXIMO_FIRMA, validarConfiguracion, validarFirma } from './validaciones';

const configuracion: ConfiguracionSistema = {
  id: 'global',
  director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: null },
  resolucionSanitaria: '0023-2024-DESA/MINSA',
  parametros: {},
  updatedAt: '2026-10-04T00:00:00.000Z',
};

const datos: DatosConfiguracion = {
  directorNombre: ' Ing. Carlos Medina Ruiz ',
  directorCip: '84512',
  directorFirma: 'data:image/png;base64,AAAA',
  resolucionSanitaria: '0023-2024-DESA/MINSA',
};

describe('configuracion-mapper', () => {
  it('lleva la configuración del API al formulario', () => {
    expect(datosDeConfiguracion(configuracion)).toEqual({
      directorNombre: 'Ing. Carlos Medina Ruiz',
      directorCip: '84512',
      directorFirma: null,
      resolucionSanitaria: '0023-2024-DESA/MINSA',
    });
  });

  it('si el API no trae director, el formulario parte vacío', () => {
    expect(datosDeConfiguracion({ ...configuracion, director: null })).toMatchObject({ directorNombre: '', directorCip: '', directorFirma: null });
  });

  it('entrega el Director Técnico con la forma que usan los documentos', () => {
    expect(directorDeConfiguracion({ ...configuracion, director: { nombre: 'Ing. Ana Paz', cip: '12345', firma: 'data:image/png;base64,AAAA' } })).toEqual({
      nombre: 'Ing. Ana Paz',
      cip: '12345',
      firma: 'data:image/png;base64,AAAA',
    });
    expect(directorDeConfiguracion({ ...configuracion, director: null })).toBeNull();
  });

  it('arma el cuerpo del PATCH con el director completo y la resolución, sin parámetros', () => {
    const cuerpo = actualizacionDeConfiguracion(datos);
    expect(cuerpo).toEqual({
      director: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512', firma: 'data:image/png;base64,AAAA' },
      resolucionSanitaria: '0023-2024-DESA/MINSA',
    });
    expect(ConfiguracionSistemaActualizacionSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('manda la firma nula para poder quitarla', () => {
    expect(actualizacionDeConfiguracion({ ...datos, directorFirma: null }).director?.firma).toBeNull();
  });

  it('reparte los errores 400 con rutas anidadas del director', () => {
    const error = new ErrorApi({ tipo: 'validacion', mensaje: 'x', campos: { 'director.cip': 'El CIP debe contener entre 4 y 7 dígitos numéricos', resolucionSanitaria: 'Requerido' } });
    expect(camposDeErrorConfiguracion(error).campos).toEqual({
      directorCip: 'El CIP debe contener entre 4 y 7 dígitos numéricos',
      resolucionSanitaria: 'Requerido',
    });
  });
});

describe('validarConfiguracion', () => {
  it('acepta datos completos', () => {
    expect(validarConfiguracion(datos)).toEqual({});
  });

  it('exige nombre, CIP de 4 a 7 dígitos y resolución sanitaria', () => {
    const errores = validarConfiguracion({ ...datos, directorNombre: ' ', directorCip: '12', resolucionSanitaria: '' });
    expect(errores.directorNombre).toBe('Campo obligatorio.');
    expect(errores.directorCip).toBe('El CIP debe contener entre 4 y 7 dígitos numéricos');
    expect(errores.resolucionSanitaria).toBe('Campo obligatorio.');
  });
});

describe('validarFirma', () => {
  const imagen = (tipo: string, bytes: number) => new File([new Uint8Array(bytes)], 'firma', { type: tipo });

  it('acepta PNG o JPG livianos', () => {
    expect(validarFirma(imagen('image/png', 1000))).toBeNull();
    expect(validarFirma(imagen('image/jpeg', 1000))).toBeNull();
  });

  it('rechaza otros formatos y archivos pesados', () => {
    expect(validarFirma(imagen('application/pdf', 1000))).toBe('La firma debe ser una imagen PNG o JPG.');
    expect(validarFirma(imagen('image/png', TAMANO_MAXIMO_FIRMA + 1))).toBe('La imagen pesa más de 1 MB. Cargue una más liviana.');
  });
});
