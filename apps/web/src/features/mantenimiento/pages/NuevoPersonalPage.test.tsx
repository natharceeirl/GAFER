import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NuevoPersonalPage } from './NuevoPersonalPage';
import type { DatosPersonal } from '../model/personal-mapper';

const inicial: DatosPersonal = {
  dni: '45892312',
  nombres: 'Marco Antonio',
  apellidos: 'Ipusari Quispe',
  cargo: 'TECNICO_OPERADOR',
  telefono: '958123456',
  usuario: 'M.IPUSARI',
};

const onRegistrar = vi.fn();
const onCancelar = vi.fn();

const montar = (props: Partial<Parameters<typeof NuevoPersonalPage>[0]> = {}) =>
  render(<NuevoPersonalPage onRegistrar={onRegistrar} onCancelar={onCancelar} {...props} />);

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

describe('NuevoPersonalPage', () => {
  beforeEach(() => {
    onRegistrar.mockReset();
    onCancelar.mockReset();
  });
  afterEach(cleanup);

  it('al intentar registrar vacío marca los campos obligatorios y no envía', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar persona' }));

    expect(screen.getByRole('heading', { name: 'Nueva persona' })).toBeInTheDocument();
    expect(screen.getByText(/Hay 5 campos por corregir/)).toBeInTheDocument();
    expect(onRegistrar).not.toHaveBeenCalled();
  });

  it('registra con los datos de la ficha; nombres y apellidos van en campos separados y el cargo como código', () => {
    montar();
    escribir('DNI', '45892312');
    escribir('Nombres', 'Marco Antonio');
    escribir('Apellidos', 'Ipusari Quispe');
    escribir('Cargo', 'TECNICO_OPERADOR');
    escribir('Teléfono', '958123456');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar persona' }));

    expect(onRegistrar).toHaveBeenCalledWith({ dni: '45892312', nombres: 'Marco Antonio', apellidos: 'Ipusari Quispe', cargo: 'TECNICO_OPERADOR', telefono: '958123456', usuario: '' });
  });

  it('el cargo se elige con etiquetas de pantalla', () => {
    montar();
    expect(within(screen.getByLabelText('Cargo')).getByRole('option', { name: 'Técnico Operador' })).toHaveValue('TECNICO_OPERADOR');
  });

  it('avisa que la clave no se define aquí, sino que la asigna el administrador del sistema', () => {
    montar();
    expect(screen.getByText(/La clave de acceso no se define en esta pantalla/)).toBeInTheDocument();
    expect(screen.getByText(/administrador del sistema/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Clave|Contraseña/i)).toBeNull();
  });

  it('en edición precarga la ficha y guarda los cambios', () => {
    montar({ inicial });

    expect(screen.getByRole('heading', { name: 'Editar persona' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombres')).toHaveValue('Marco Antonio');
    expect(screen.getByLabelText('Usuario (opcional)')).toHaveValue('M.IPUSARI');
    expect(screen.getByText(/La clave de acceso no se define en esta pantalla/)).toBeInTheDocument();

    escribir('Teléfono', '999888777');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar persona' }));

    expect(onRegistrar).toHaveBeenCalledWith({ ...inicial, telefono: '999888777' });
  });

  it('rechaza un DNI que no tiene 8 dígitos con el mensaje del esquema compartido', () => {
    montar({ inicial });
    escribir('DNI', '1234');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar persona' }));

    expect(screen.getByText('El DNI tiene 8 dígitos, sin letras ni espacios')).toBeInTheDocument();
    expect(onRegistrar).not.toHaveBeenCalled();
  });

  it('adelanta el aviso si el DNI ya lo tiene otra persona cargada', () => {
    montar({ inicial, existentes: { dnis: ['47210345'], usuarios: [] } });
    escribir('DNI', '47210345');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar persona' }));

    expect(screen.getByText('Ya hay una persona registrada con ese DNI.')).toBeInTheDocument();
    expect(onRegistrar).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor sobre su campo y lo quita al corregirlo', () => {
    montar({ inicial, erroresServidor: { usuario: 'Ya hay una persona con ese usuario.' } });

    expect(screen.getByText('Ya hay una persona con ese usuario.')).toBeInTheDocument();
    escribir('Usuario (opcional)', 'OTRO');
    expect(screen.queryByText('Ya hay una persona con ese usuario.')).toBeNull();
  });

  it('mientras guarda bloquea los botones y muestra el error general', () => {
    montar({ inicial, enviando: true, errorGeneral: 'No se pudo conectar con el servidor.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});
