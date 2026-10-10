import { describe, expect, it } from 'vitest';
import { PersonalActualizacionSchema, PersonalRegistroSchema, type Personal } from '@gafer/contracts';
import { ErrorApi } from '../../../shared/api/errores';
import {
  actualizacionDePersonal,
  camposDeErrorPersonal,
  campoDeRutaPersonal,
  datosDePersonal,
  nombreCompleto,
  registroDePersonal,
  type DatosPersonal,
} from './personal-mapper';
import { validarPersonal } from './validaciones';

const personal: Personal = {
  id: '33333333-3333-4333-8333-333333333333',
  dni: '45892312',
  nombres: 'Marco Antonio',
  apellidos: 'Ipusari Quispe',
  cargo: 'TECNICO_OPERADOR',
  telefono: '958123456',
  usuario: 'M.IPUSARI',
  estado: 'ACTIVO',
};

const datos: DatosPersonal = {
  dni: '45892312',
  nombres: ' Marco Antonio ',
  apellidos: 'Ipusari Quispe',
  cargo: 'TECNICO_OPERADOR',
  telefono: '958123456',
  usuario: '',
};

describe('personal-mapper', () => {
  it('une nombres y apellidos en el nombre que se muestra', () => {
    expect(nombreCompleto(personal)).toBe('Marco Antonio Ipusari Quispe');
  });

  it('lleva el personal del API al formulario (usuario nulo es texto vacío)', () => {
    expect(datosDePersonal(personal)).toEqual({ ...datos, nombres: 'Marco Antonio', usuario: 'M.IPUSARI' });
    expect(datosDePersonal({ ...personal, usuario: null }).usuario).toBe('');
  });

  it('arma el alta con el cargo como código, sin espacios sobrantes y con usuario nulo si está vacío', () => {
    const cuerpo = registroDePersonal(datos);
    expect(cuerpo).toEqual({ dni: '45892312', nombres: 'Marco Antonio', apellidos: 'Ipusari Quispe', cargo: 'TECNICO_OPERADOR', telefono: '958123456', usuario: null });
    expect(PersonalRegistroSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('arma la edición sin clave, ya que el API no tiene un campo de clave', () => {
    const cuerpo = actualizacionDePersonal({ ...datos, usuario: 'm.ipusari' });
    expect(cuerpo.usuario).toBe('m.ipusari');
    expect(Object.keys(cuerpo).sort()).toEqual(['apellidos', 'cargo', 'dni', 'nombres', 'telefono', 'usuario']);
    expect(PersonalActualizacionSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('traduce las rutas del API a campos del formulario', () => {
    expect(campoDeRutaPersonal('dni')).toBe('dni');
    expect(campoDeRutaPersonal('usuario')).toBe('usuario');
    expect(campoDeRutaPersonal('estado')).toBeNull();
  });

  it('un 409 por DNI o por usuario repetido marca su campo', () => {
    const dni = new ErrorApi({ tipo: 'conflicto', mensaje: 'Ya existe un colaborador registrado con el DNI: 45892312' });
    expect(camposDeErrorPersonal(dni).campos.dni).toMatch(/DNI/);
    const usuario = new ErrorApi({ tipo: 'conflicto', mensaje: 'Ya existe un usuario en el sistema con el username: M.IPUSARI' });
    expect(camposDeErrorPersonal(usuario).campos.usuario).toMatch(/usuario/i);
  });

  it('reparte un 400 por campo', () => {
    const error = new ErrorApi({ tipo: 'validacion', mensaje: 'x', campos: { telefono: 'Muy corto' } });
    expect(camposDeErrorPersonal(error).campos).toEqual({ telefono: 'Muy corto' });
  });
});

describe('validarPersonal', () => {
  it('acepta un personal completo; el usuario es opcional', () => {
    expect(validarPersonal(datos)).toEqual({});
  });

  it('marca como obligatorios los datos vacíos y el cargo sin elegir', () => {
    const errores = validarPersonal({ dni: '', nombres: ' ', apellidos: '', cargo: '', telefono: '', usuario: '' });
    expect(Object.keys(errores).sort()).toEqual(['apellidos', 'cargo', 'dni', 'nombres', 'telefono']);
  });

  it('exige un DNI de 8 dígitos con el mensaje del esquema compartido', () => {
    expect(validarPersonal({ ...datos, dni: '1234' }).dni).toBe('El DNI tiene 8 dígitos, sin letras ni espacios');
  });

  it('rechaza un teléfono con letras', () => {
    expect(validarPersonal({ ...datos, telefono: 'abc' }).telefono).toMatch(/dígitos/);
  });

  it('avisa si el DNI o el usuario ya los tiene otra persona cargada', () => {
    const errores = validarPersonal({ ...datos, usuario: 'm.ipusari' }, { dnis: ['45892312'], usuarios: ['M.IPUSARI'] });
    expect(errores.dni).toBe('Ya hay una persona registrada con ese DNI.');
    expect(errores.usuario).toBe('Ya hay una persona con ese usuario.');
  });
});
