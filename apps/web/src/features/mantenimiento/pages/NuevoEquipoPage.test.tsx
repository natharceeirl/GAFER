import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NuevoEquipoPage } from './NuevoEquipoPage';
import type { DatosEquipo } from '../model/equipo-mapper';

const inicial: DatosEquipo = {
  codigoInterno: 'EQ-022',
  nombre: 'Aspersora de mochila 20L',
  tipo: 'ASPERSION',
  marcaModelo: 'Jacto XP',
  fechaAdquisicion: '2024-03-10',
  ultimoMantenimiento: '',
  proximoMantenimiento: '',
};

const onRegistrar = vi.fn();
const onCancelar = vi.fn();

const montar = (props: Partial<Parameters<typeof NuevoEquipoPage>[0]> = {}) =>
  render(<NuevoEquipoPage onRegistrar={onRegistrar} onCancelar={onCancelar} {...props} />);

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

describe('NuevoEquipoPage', () => {
  beforeEach(() => {
    onRegistrar.mockReset();
    onCancelar.mockReset();
  });
  afterEach(cleanup);

  it('al intentar registrar con el formulario vacío marca los obligatorios y no envía', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar equipo' }));

    expect(screen.getByRole('heading', { name: 'Nuevo equipo' })).toBeInTheDocument();
    expect(screen.getByText(/Hay 3 campos por corregir/)).toBeInTheDocument();
    expect(onRegistrar).not.toHaveBeenCalled();
  });

  it('registra con solo los datos obligatorios; los opcionales quedan vacíos', () => {
    montar();
    escribir('Código interno', 'eq-031');
    escribir('Nombre del equipo', 'Detector de humedad');
    escribir('Tipo de equipo', 'MEDICION');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar equipo' }));

    expect(onRegistrar).toHaveBeenCalledWith({
      codigoInterno: 'EQ-031',
      nombre: 'Detector de humedad',
      tipo: 'MEDICION',
      marcaModelo: '',
      fechaAdquisicion: '',
      ultimoMantenimiento: '',
      proximoMantenimiento: '',
    });
  });

  it('el tipo se elige con etiquetas de pantalla y valores de la base', () => {
    montar();
    expect(within(screen.getByLabelText('Tipo de equipo')).getByRole('option', { name: 'Nebulización' })).toHaveValue('NEBULIZACION');
  });

  it('en edición precarga la ficha y no ofrece cambiar el estado operativo', () => {
    montar({ inicial });

    expect(screen.getByRole('heading', { name: 'Editar equipo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Marca y modelo (opcional)')).toHaveValue('Jacto XP');
    expect(screen.getByLabelText('Fecha de adquisición (opcional)')).toHaveValue('2024-03-10');
    expect(screen.queryByLabelText(/Estado operativo/)).toBeNull();

    escribir('Nombre del equipo', 'Aspersora de mochila 25L');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));

    expect(onRegistrar).toHaveBeenCalledWith({ ...inicial, nombre: 'Aspersora de mochila 25L' });
  });

  it('muestra el error del servidor sobre el código interno y lo quita al corregirlo', () => {
    montar({ inicial, erroresServidor: { codigoInterno: 'Ya existe un equipo con ese código interno.' } });

    expect(screen.getByText('Ya existe un equipo con ese código interno.')).toBeInTheDocument();
    escribir('Código interno', 'EQ-099');
    expect(screen.queryByText('Ya existe un equipo con ese código interno.')).toBeNull();
  });

  it('mientras guarda bloquea los botones y muestra el error general', () => {
    montar({ inicial, enviando: true, errorGeneral: 'El servidor no pudo completar la operación.' });
    expect(screen.getByRole('alert')).toHaveTextContent('El servidor no pudo completar la operación.');
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});
