import { describe, expect, it } from 'vitest';
import { ProyectoActualizacionSchema, ProyectoRegistroSchema, type ProyectoDetalle } from '@gafer/contracts';
import { ErrorApi } from '../../../shared/api/errores';
import {
  actualizacionDeProyecto,
  camposDeErrorProyecto,
  datosDeProyecto,
  proyectoDeApi,
  registroDeProyecto,
} from './proyecto-mapper';
import type { DatosProyecto } from './validaciones';

const CLIENTE = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';

const detalle: ProyectoDetalle = {
  id: '7b1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a33',
  clienteId: CLIENTE,
  nombre: 'PLANTA_NORTE',
  direccionSede: 'Parque Industrial Mz. B',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  observaciones: null,
  estado: 'INACTIVO',
};

const datos: DatosProyecto = {
  nombre: ' PLANTA_NORTE ',
  direccion: ' Parque Industrial Mz. B ',
  distrito: 'Cerro Colorado ',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: ' Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: ' 054 223344 ',
  observaciones: '  Ingreso con casco  ',
};

describe('proyecto-mapper', () => {
  it('proyectoDeApi llama direccion a direccionSede y trae las observaciones nulas como texto vacío', () => {
    const sede = proyectoDeApi(detalle, []);
    expect(sede).toMatchObject({ id: detalle.id, clienteId: CLIENTE, direccion: 'Parque Industrial Mz. B', observaciones: '', estado: 'INACTIVO' });
    expect(sede.servicios).toEqual([]);
  });

  it('datosDeProyecto devuelve lo editable de la sede', () => {
    expect(datosDeProyecto(proyectoDeApi(detalle, []))).toEqual({
      nombre: 'PLANTA_NORTE',
      direccion: 'Parque Industrial Mz. B',
      distrito: 'Cerro Colorado',
      provincia: 'Arequipa',
      departamento: 'Arequipa',
      contactoNombre: 'Luis Rojas',
      contactoCargo: 'Jefe de Planta',
      contactoTelefono: '054 223344',
      observaciones: '',
    });
  });

  it('registroDeProyecto arma el cuerpo del alta con textos recortados y cumple el esquema', () => {
    const cuerpo = registroDeProyecto(CLIENTE, datos);
    expect(cuerpo).toEqual({
      clienteId: CLIENTE,
      nombre: 'PLANTA_NORTE',
      direccionSede: 'Parque Industrial Mz. B',
      distrito: 'Cerro Colorado',
      provincia: 'Arequipa',
      departamento: 'Arequipa',
      contactoNombre: 'Luis Rojas',
      contactoCargo: 'Jefe de Planta',
      contactoTelefono: '054 223344',
      observaciones: 'Ingreso con casco',
    });
    expect(ProyectoRegistroSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('las observaciones vacías viajan como null (para poder borrarlas en la edición)', () => {
    expect(registroDeProyecto(CLIENTE, { ...datos, observaciones: '  ' }).observaciones).toBeNull();
  });

  it('actualizacionDeProyecto no envía el cliente ni el estado y cumple el esquema', () => {
    const cuerpo = actualizacionDeProyecto(datos);
    expect(cuerpo).not.toHaveProperty('clienteId');
    expect(cuerpo).not.toHaveProperty('estado');
    expect(cuerpo).toMatchObject({ nombre: 'PLANTA_NORTE', direccionSede: 'Parque Industrial Mz. B' });
    expect(ProyectoActualizacionSchema.safeParse(cuerpo).success).toBe(true);
  });

  describe('camposDeErrorProyecto', () => {
    it('traduce las rutas del API a los campos del formulario (direccionSede → direccion)', () => {
      const error = new ErrorApi({
        tipo: 'validacion',
        mensaje: 'Los datos enviados no son válidos.',
        status: 400,
        campos: { direccionSede: 'Obligatorio', contactoTelefono: 'Teléfono inválido', clienteId: 'ignorado' },
      });
      expect(camposDeErrorProyecto(error)).toEqual({
        campos: { direccion: 'Obligatorio', contactoTelefono: 'Teléfono inválido' },
        general: 'Los datos enviados no son válidos.',
      });
    });

    it('un 409 por nombre repetido se marca en el campo nombre', () => {
      const error = new ErrorApi({ tipo: 'conflicto', mensaje: 'Ya existe una sede registrada con el nombre: PLANTA_NORTE', status: 409 });
      expect(camposDeErrorProyecto(error)).toEqual({
        campos: { nombre: 'Este cliente ya tiene una sede con ese nombre.' },
        general: null,
      });
    });

    it('cualquier otro error queda como mensaje general', () => {
      const error = new ErrorApi({ tipo: 'prohibido', mensaje: 'No tiene permiso para realizar esta acción.', status: 403 });
      expect(camposDeErrorProyecto(error)).toEqual({ campos: {}, general: 'No tiene permiso para realizar esta acción.' });
    });
  });
});
