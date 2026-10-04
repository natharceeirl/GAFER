import { leerDatosUsuario } from './crear-usuario';

describe('Lectura de los datos del comando db:crear-usuario', () => {
  const argv = ['--usuario', 'm.quispe', '--cargo', 'ADMINISTRADOR', '--dni', '45892312'];

  it('toma los datos de los argumentos y de las variables GAFER_*, y la clave solo del entorno', () => {
    const datos = leerDatosUsuario(argv, {
      GAFER_NOMBRES: 'Maria',
      GAFER_APELLIDOS: 'Quispe Rojas',
      GAFER_TELEFONO: '958123456',
      GAFER_CLAVE: 'una-clave-de-12',
    });

    expect(datos).toEqual({
      usuario: 'm.quispe',
      cargo: 'ADMINISTRADOR',
      dni: '45892312',
      nombres: 'Maria',
      apellidos: 'Quispe Rojas',
      telefono: '958123456',
      clave: 'una-clave-de-12',
    });
  });

  it('un argumento tiene prioridad sobre la variable de entorno equivalente', () => {
    const datos = leerDatosUsuario([...argv, '--nombres', 'Ana'], { GAFER_NOMBRES: 'Maria' });
    expect(datos.nombres).toBe('Ana');
  });

  it('no acepta la clave por argumento, para que no quede en el historial ni en la lista de procesos', () => {
    expect(() => leerDatosUsuario([...argv, '--clave', 'una-clave-de-12'], {})).toThrow(/GAFER_CLAVE/);
  });

  it('rechaza argumentos desconocidos o sin valor', () => {
    expect(() => leerDatosUsuario(['--rol', 'ADMINISTRADOR'], {})).toThrow(/--rol/);
    expect(() => leerDatosUsuario(['--usuario'], {})).toThrow(/--usuario/);
  });
});
