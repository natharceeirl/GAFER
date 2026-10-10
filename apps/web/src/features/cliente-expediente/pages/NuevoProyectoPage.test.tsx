import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NuevoProyectoPage } from './NuevoProyectoPage';
import { CLIENTES_MOCK } from '../model/clientes-mock';
import type { DatosProyecto } from '../model/validaciones';

const cliente = CLIENTES_MOCK[0];

const existente: DatosProyecto = {
  nombre: 'PLANTA_NORTE',
  direccion: 'Parque Industrial Mz. B',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  observaciones: 'Ingreso con casco',
};

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function completarAlta() {
  escribir('Nombre del proyecto', 'planta norte');
  escribir('Dirección de la sede', 'Parque Industrial Mz. B');
  escribir('Distrito', 'Cerro Colorado');
  escribir('Nombre', 'Luis Rojas');
  escribir('Cargo', 'Jefe de Planta');
  escribir('Teléfono', '054 223344');
}

describe('NuevoProyectoPage — alta de sede', () => {
  it('con datos válidos entrega la sede (nombre en mayúsculas y con guion bajo) y no ofrece elegir estado', () => {
    const onRegistrar = vi.fn();
    render(<NuevoProyectoPage cliente={cliente} nombresExistentes={[]} onRegistrar={onRegistrar} onCancelar={() => {}} />);
    completarAlta();
    expect(screen.queryByRole('radio', { name: 'Inactivo' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar sede' }));

    expect(onRegistrar).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'PLANTA_NORTE', provincia: 'Arequipa', departamento: 'Arequipa' }));
  });

  it('no envía y marca los campos si faltan datos o el nombre ya existe', () => {
    const onRegistrar = vi.fn();
    render(<NuevoProyectoPage cliente={cliente} nombresExistentes={['PLANTA_NORTE']} onRegistrar={onRegistrar} onCancelar={() => {}} />);
    completarAlta();
    escribir('Distrito', '');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar sede' }));

    expect(onRegistrar).not.toHaveBeenCalled();
    expect(screen.getByText('Este cliente ya tiene una sede con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Distrito')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Hay 2 campos por corregir.');
  });

  it('muestra los errores del servidor en su campo y los quita al corregirlo', () => {
    const { rerender } = render(<NuevoProyectoPage cliente={cliente} nombresExistentes={[]} onRegistrar={() => {}} onCancelar={() => {}} />);
    completarAlta();
    rerender(
      <NuevoProyectoPage
        cliente={cliente}
        nombresExistentes={[]}
        erroresServidor={{ nombre: 'Este cliente ya tiene una sede con ese nombre.', contactoTelefono: 'Teléfono rechazado' }}
        errorGeneral="Los datos enviados no son válidos."
        onRegistrar={() => {}}
        onCancelar={() => {}}
      />,
    );

    expect(screen.getByText('Teléfono rechazado')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del proyecto')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Los datos enviados no son válidos.')).toBeInTheDocument();

    escribir('Teléfono', '054 998877');
    expect(screen.queryByText('Teléfono rechazado')).not.toBeInTheDocument();
  });

  it('mientras guarda deshabilita los botones y no vuelve a enviar', () => {
    const onRegistrar = vi.fn();
    render(<NuevoProyectoPage cliente={cliente} nombresExistentes={[]} enviando onRegistrar={onRegistrar} onCancelar={() => {}} />);
    completarAlta();

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: 'Guardando…' }).closest('form') as HTMLFormElement);
    expect(onRegistrar).not.toHaveBeenCalled();
  });
});

describe('NuevoProyectoPage — edición de sede', () => {
  it('precarga la sede, valida el nombre con el rango de la base y entrega lo editado', () => {
    const onRegistrar = vi.fn();
    render(<NuevoProyectoPage cliente={cliente} nombresExistentes={[]} inicial={existente} onRegistrar={onRegistrar} onCancelar={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Editar sede' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del proyecto')).toHaveValue('PLANTA_NORTE');
    expect(screen.getByLabelText('Observaciones del proyecto (opcional)')).toHaveValue('Ingreso con casco');

    escribir('Distrito', 'Yanahuara');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sede' }));

    expect(onRegistrar).toHaveBeenCalledWith({ ...existente, distrito: 'Yanahuara' });
  });
});
