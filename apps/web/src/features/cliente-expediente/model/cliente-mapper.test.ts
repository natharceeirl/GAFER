import { describe, expect, it } from 'vitest';
import type { ClienteDetalle } from '@gafer/contracts';
import { ErrorApi } from '../../../shared/api/errores';
import {
  ANTICIPACION_ALERTA_POR_DEFECTO,
  actualizacionDeDatos,
  anticipacionDe,
  camposDeError,
  datosDeFila,
  filaDeApi,
  listadoDeApi,
  registroDeDatos,
} from './cliente-mapper';
import type { DatosCliente } from './validaciones';

const detalle: ClienteDetalle = {
  id: '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11',
  razonSocial: 'Kallpa Energía S.A.',
  ruc: '20512345678',
  codigoCorto: 'KALLPA',
  direccionFiscal: 'Av. Víctor Andrés Belaúnde 147',
  giroNegocio: 'Energía',
  contactoNombre: 'Rosa Contreras',
  contactoCargo: 'Jefa de Planta',
  contactoTelefono: '959 214 380',
  contactoCorreo: 'rcontreras@kallpa.pe',
  estado: 'ACTIVO',
  camposExtra: { anticipacionAlertaDias: 45, otro: 'x' },
};

const datos: DatosCliente = {
  razonSocial: '  Molinos del Sur S.A.C. ',
  ruc: '20611122233',
  codigoCorto: 'MOLISUR',
  direccionFiscal: ' Av. Ejército 101 ',
  giro: 'Alimentos',
  contactoNombre: 'Carla Pinto ',
  contactoCargo: 'Jefa de Calidad',
  contactoTelefono: ' 959 123 456',
  contactoCorreo: ' cpinto@molisur.pe ',
  estado: 'ACTIVO',
};

describe('mapeo API ↔ modelo de vista de clientes', () => {
  it('filaDeApi arma la ficha del cliente con el contacto agrupado y la anticipación en días', () => {
    expect(filaDeApi(detalle)).toEqual({
      id: detalle.id,
      codigoCorto: 'KALLPA',
      razonSocial: 'Kallpa Energía S.A.',
      ruc: '20512345678',
      giro: 'Energía',
      direccionFiscal: 'Av. Víctor Andrés Belaúnde 147',
      contacto: { nombre: 'Rosa Contreras', cargo: 'Jefa de Planta', telefono: '959 214 380', correo: 'rcontreras@kallpa.pe' },
      ultimoServicio: null,
      proximoVencimiento: null,
      anticipacionAlertaDias: 45,
      estado: 'ACTIVO',
    });
  });

  it('listadoDeApi usa solo lo que el listado del API trae', () => {
    const fila = listadoDeApi({
      id: detalle.id,
      razonSocial: 'Plastiq Industrial S.A.',
      ruc: '20567123489',
      codigoCorto: 'PLASTIQ',
      estado: 'INACTIVO',
      giroNegocio: 'Construcción',
      contactoNombre: 'Hugo Díaz',
      contactoTelefono: '954 227 118',
      contactoCorreo: 'hdiaz@plastiq.pe',
    });
    expect(fila).toEqual({
      id: detalle.id,
      codigoCorto: 'PLASTIQ',
      razonSocial: 'Plastiq Industrial S.A.',
      ruc: '20567123489',
      giro: 'Construcción',
      ultimoServicio: null,
      proximoVencimiento: null,
      estado: 'INACTIVO',
    });
  });

  describe('anticipacionDe', () => {
    it('lee los días de camposExtra', () => {
      expect(anticipacionDe({ anticipacionAlertaDias: 60 })).toBe(60);
    });
    it.each([[undefined], [{}], [{ anticipacionAlertaDias: 'abc' }], [{ anticipacionAlertaDias: 0 }], [{ anticipacionAlertaDias: -5 }], [{ anticipacionAlertaDias: 2.5 }]])(
      'usa 30 días si el dato falta o no es válido (%j)',
      (extra) => {
        expect(anticipacionDe(extra)).toBe(ANTICIPACION_ALERTA_POR_DEFECTO);
        expect(ANTICIPACION_ALERTA_POR_DEFECTO).toBe(30);
      },
    );
  });

  it('datosDeFila devuelve los datos del formulario de la ficha', () => {
    expect(datosDeFila(filaDeApi(detalle))).toEqual({
      razonSocial: 'Kallpa Energía S.A.',
      ruc: '20512345678',
      codigoCorto: 'KALLPA',
      direccionFiscal: 'Av. Víctor Andrés Belaúnde 147',
      giro: 'Energía',
      contactoNombre: 'Rosa Contreras',
      contactoCargo: 'Jefa de Planta',
      contactoTelefono: '959 214 380',
      contactoCorreo: 'rcontreras@kallpa.pe',
      estado: 'ACTIVO',
    });
  });

  it('registroDeDatos arma el cuerpo del alta con textos recortados y la anticipación en camposExtra', () => {
    expect(registroDeDatos(datos, 60)).toEqual({
      razonSocial: 'Molinos del Sur S.A.C.',
      ruc: '20611122233',
      codigoCorto: 'MOLISUR',
      direccionFiscal: 'Av. Ejército 101',
      giroNegocio: 'Alimentos',
      contactoNombre: 'Carla Pinto',
      contactoCargo: 'Jefa de Calidad',
      contactoTelefono: '959 123 456',
      contactoCorreo: 'cpinto@molisur.pe',
      camposExtra: { anticipacionAlertaDias: 60 },
    });
  });

  it('actualizacionDeDatos no envía el RUC ni el código corto ni el estado', () => {
    const cuerpo = actualizacionDeDatos(datos, 15);
    expect(cuerpo).not.toHaveProperty('ruc');
    expect(cuerpo).not.toHaveProperty('codigoCorto');
    expect(cuerpo).not.toHaveProperty('estado');
    expect(cuerpo).toMatchObject({ razonSocial: 'Molinos del Sur S.A.C.', giroNegocio: 'Alimentos', camposExtra: { anticipacionAlertaDias: 15 } });
  });

  describe('camposDeError', () => {
    it('traduce las rutas del API a los campos del formulario (giroNegocio → giro)', () => {
      const error = new ErrorApi({
        tipo: 'validacion',
        mensaje: 'Los datos enviados no son válidos.',
        status: 400,
        campos: { giroNegocio: 'Obligatorio', contactoCorreo: 'Correo inválido', 'camposExtra.x': 'ignorado' },
      });
      expect(camposDeError(error)).toEqual({
        campos: { giro: 'Obligatorio', contactoCorreo: 'Correo inválido' },
        general: 'Los datos enviados no son válidos.',
      });
    });

    it('un 409 por RUC repetido se marca en el campo RUC', () => {
      const error = new ErrorApi({ tipo: 'conflicto', mensaje: 'Ya existe un cliente registrado con el RUC: 20611122233', status: 409 });
      expect(camposDeError(error)).toEqual({
        campos: { ruc: 'Ya hay un cliente registrado con ese RUC.' },
        general: null,
      });
    });

    it('un 409 por código corto repetido se marca en el código corto', () => {
      const error = new ErrorApi({ tipo: 'conflicto', mensaje: 'Ya existe un cliente con el código corto: MOLISUR', status: 409 });
      expect(camposDeError(error)).toEqual({
        campos: { codigoCorto: 'Ese código ya lo usa otro cliente.' },
        general: null,
      });
    });

    it('cualquier otro error queda como mensaje general', () => {
      const error = new ErrorApi({ tipo: 'red', mensaje: 'No se pudo conectar con el servidor.' });
      expect(camposDeError(error)).toEqual({ campos: {}, general: 'No se pudo conectar con el servidor.' });
      expect(camposDeError(new Error('x'))).toEqual({ campos: {}, general: expect.any(String) });
    });
  });
});
