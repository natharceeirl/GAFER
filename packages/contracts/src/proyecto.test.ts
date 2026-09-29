import { describe, expect, it } from 'vitest';
import {
  ProyectoActualizacionSchema,
  ProyectoDetalleSchema,
  ProyectoRegistroSchema,
  ProyectoSchema,
} from './proyecto';
import { esperarFallaEn } from './pruebas';

const registro = {
  clienteId: '11111111-1111-1111-1111-111111111111',
  nombre: 'PLANTA_SUR',
  direccionSede: 'Carretera Costanera Km 12',
  distrito: 'Mollendo',
  provincia: 'Islay',
  departamento: 'Arequipa',
  contactoNombre: 'Mario Vargas',
  contactoCargo: 'Jefe de planta',
  contactoTelefono: '958123456',
};

describe('ProyectoRegistroSchema (Spec §7.2)', () => {
  it('acepta una sede válida con y sin observaciones', () => {
    expect(ProyectoRegistroSchema.safeParse(registro).success).toBe(true);
    expect(ProyectoRegistroSchema.safeParse({ ...registro, observaciones: 'Acceso por puerta 2' }).success).toBe(true);
    expect(ProyectoRegistroSchema.safeParse({ ...registro, observaciones: null }).success).toBe(true);
  });

  it.each(['SUR', 'planta_sur', 'PLANTA SUR', 'A'.repeat(21)])('rechaza el nombre %j', (nombre) =>
    esperarFallaEn(ProyectoRegistroSchema, { ...registro, nombre }, 'nombre'),
  );

  it('acepta los bordes de 4 y 20 caracteres', () => {
    expect(ProyectoRegistroSchema.safeParse({ ...registro, nombre: 'PLAN' }).success).toBe(true);
    expect(ProyectoRegistroSchema.safeParse({ ...registro, nombre: 'A'.repeat(20) }).success).toBe(true);
  });

  it('rechaza cliente no UUID y ubicación vacía', () => {
    esperarFallaEn(ProyectoRegistroSchema, { ...registro, clienteId: 'p1' }, 'clienteId');
    esperarFallaEn(ProyectoRegistroSchema, { ...registro, distrito: '' }, 'distrito');
    esperarFallaEn(ProyectoRegistroSchema, { ...registro, contactoTelefono: '12' }, 'contactoTelefono');
  });
});

describe('ProyectoDetalleSchema', () => {
  const detalle = { ...registro, id: '22222222-2222-2222-2222-222222222222', estado: 'INACTIVO' };

  it('acepta una sede persistida y tolera nombres históricos de 3 a 50 caracteres', () => {
    expect(ProyectoDetalleSchema.safeParse(detalle).success).toBe(true);
    expect(ProyectoDetalleSchema.safeParse({ ...detalle, nombre: 'ABC' }).success).toBe(true);
    expect(ProyectoDetalleSchema.safeParse({ ...detalle, nombre: 'A'.repeat(50) }).success).toBe(true);
    esperarFallaEn(ProyectoDetalleSchema, { ...detalle, nombre: 'A'.repeat(51) }, 'nombre');
  });
});

describe('ProyectoSchema (contrato original)', () => {
  it('sigue aceptando la forma resumida original', () => {
    const ok = ProyectoSchema.safeParse({
      id: '22222222-2222-2222-2222-222222222222',
      clienteId: '11111111-1111-1111-1111-111111111111',
      nombre: 'PLANTA',
      direccion: 'Av. Industrial 1',
      estado: 'ACTIVO',
    });
    expect(ok.success).toBe(true);
  });
});

describe('ProyectoActualizacionSchema', () => {
  it('acepta actualización parcial válida', () => {
    const res = ProyectoActualizacionSchema.safeParse({
      nombre: 'PLANTA_NORTE_2',
      contactoTelefono: '958999888',
    });
    expect(res.success).toBe(true);
  });

  it('rechaza nombre con formato inválido en actualización', () => {
    esperarFallaEn(ProyectoActualizacionSchema, { nombre: 'planta baja' }, 'nombre');
  });
});
