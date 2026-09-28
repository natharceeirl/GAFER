import { describe, expect, it } from 'vitest';
import { ClienteDetalleSchema, ClienteRegistroSchema } from './cliente';
import { esperarFallaEn } from './pruebas';

const registro = {
  razonSocial: 'Kallpa Generación S.A.',
  ruc: '20508565434',
  codigoCorto: 'KALLPA',
  direccionFiscal: 'Av. Las Palmas 123, Mollendo',
  giroNegocio: 'Generación eléctrica',
  contactoNombre: 'Carlos Ramos',
  contactoCargo: 'Jefe de SSOMA',
  contactoTelefono: '958123456',
  contactoCorreo: 'cramos@kallpa.pe',
};

describe('ClienteRegistroSchema (Spec §7.1)', () => {
  it('acepta un cliente válido, con o sin campos extra', () => {
    expect(ClienteRegistroSchema.safeParse(registro).success).toBe(true);
    expect(ClienteRegistroSchema.safeParse({ ...registro, camposExtra: { sector: 'energía' } }).success).toBe(true);
  });

  it('rechaza un RUC que no tiene 11 dígitos', () => esperarFallaEn(ClienteRegistroSchema, { ...registro, ruc: '2050856' }, 'ruc'));

  it.each(['KAL', 'KALLPAENERGIA', 'kallpa', 'KALL PA', 'KALL_PA'])('rechaza el código corto %j', (codigo) =>
    esperarFallaEn(ClienteRegistroSchema, { ...registro, codigoCorto: codigo }, 'codigoCorto'),
  );

  it('acepta los bordes de 4 y 10 caracteres en el código corto', () => {
    expect(ClienteRegistroSchema.safeParse({ ...registro, codigoCorto: 'ABCD' }).success).toBe(true);
    expect(ClienteRegistroSchema.safeParse({ ...registro, codigoCorto: 'ABCDE12345' }).success).toBe(true);
  });

  it('rechaza correo inválido y razón social vacía', () => {
    esperarFallaEn(ClienteRegistroSchema, { ...registro, contactoCorreo: 'sin-arroba' }, 'contactoCorreo');
    esperarFallaEn(ClienteRegistroSchema, { ...registro, razonSocial: '' }, 'razonSocial');
  });

  it('rechaza un dato sin dirección fiscal', () => {
    const { direccionFiscal: _omitida, ...sinDireccion } = registro;
    esperarFallaEn(ClienteRegistroSchema, sinDireccion, 'direccionFiscal');
  });
});

describe('ClienteDetalleSchema', () => {
  const detalle = { ...registro, id: '11111111-1111-1111-1111-111111111111', estado: 'ACTIVO' };

  it('acepta un cliente persistido', () => expect(ClienteDetalleSchema.safeParse(detalle).success).toBe(true));

  it('tolera códigos históricos de 3 caracteres o con guion bajo (regla de la base de datos)', () => {
    expect(ClienteDetalleSchema.safeParse({ ...detalle, codigoCorto: 'ABC' }).success).toBe(true);
    expect(ClienteDetalleSchema.safeParse({ ...detalle, codigoCorto: 'SAMAY_1' }).success).toBe(true);
  });

  it('rechaza id no UUID y estado desconocido', () => {
    esperarFallaEn(ClienteDetalleSchema, { ...detalle, id: 'c1' }, 'id');
    esperarFallaEn(ClienteDetalleSchema, { ...detalle, estado: 'SUSPENDIDO' }, 'estado');
  });

  it('ignora campos que una versión futura del servidor agregue (compatibilidad hacia atrás)', () => {
    const res = ClienteDetalleSchema.safeParse({ ...detalle, campoNuevo: 1 });
    expect(res.success).toBe(true);
  });
});
