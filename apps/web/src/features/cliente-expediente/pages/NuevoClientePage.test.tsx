import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NuevoClientePage } from './NuevoClientePage';
import type { DatosCliente } from '../model/validaciones';

const GIROS = ['Alimentos', 'Energía', 'Salud'];

const existente: DatosCliente = {
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
};

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function completarAlta() {
  escribir('Razón social', 'Molinos del Sur S.A.C.');
  escribir('RUC', '20611122233');
  escribir('Código corto', 'molisur');
  escribir('Dirección fiscal', 'Av. Ejército 101');
  escribir('Giro del negocio', 'Alimentos');
  escribir('Nombre', 'Carla Pinto');
  escribir('Cargo', 'Jefa de Calidad');
  escribir('Teléfono', '959 123 456');
  escribir('Correo', 'cpinto@molisur.pe');
}

function enviar(texto: string) {
  fireEvent.click(screen.getByRole('button', { name: texto }));
}

describe('NuevoClientePage — alta', () => {
  it('con datos válidos entrega la ficha normalizada y la anticipación elegida', () => {
    const onRegistrar = vi.fn();
    render(<NuevoClientePage giros={GIROS} onRegistrar={onRegistrar} onCancelar={() => {}} />);
    completarAlta();
    fireEvent.change(screen.getByLabelText('Avisar el vencimiento del certificado con'), { target: { value: '60' } });

    enviar('Registrar cliente');

    expect(onRegistrar).toHaveBeenCalledTimes(1);
    expect(onRegistrar.mock.calls[0][0]).toMatchObject({ ruc: '20611122233', codigoCorto: 'MOLISUR', giro: 'Alimentos', estado: 'ACTIVO' });
    expect(onRegistrar.mock.calls[0][1]).toBe(60);
  });

  it('valida con los esquemas compartidos y no envía si hay errores', () => {
    const onRegistrar = vi.fn();
    render(<NuevoClientePage giros={GIROS} onRegistrar={onRegistrar} onCancelar={() => {}} />);
    completarAlta();
    escribir('RUC', '2061112');
    escribir('Correo', 'cpinto@');

    enviar('Registrar cliente');

    expect(onRegistrar).not.toHaveBeenCalled();
    expect(screen.getByText('El RUC tiene 11 dígitos, sin letras ni espacios')).toBeInTheDocument();
    expect(screen.getByLabelText('RUC')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Hay 2 campos por corregir.');
  });

  it('no ofrece el estado en el alta: el servidor registra al cliente como activo', () => {
    render(<NuevoClientePage giros={GIROS} onRegistrar={() => {}} onCancelar={() => {}} />);

    expect(screen.queryByRole('radiogroup', { name: 'Estado' })).not.toBeInTheDocument();
  });

  it('muestra los errores del servidor en su campo y el mensaje general', () => {
    render(
      <NuevoClientePage
        giros={GIROS}
        erroresServidor={{ ruc: 'Ya hay un cliente registrado con ese RUC.' }}
        errorGeneral="No se pudo registrar el cliente."
        onRegistrar={() => {}}
        onCancelar={() => {}}
      />,
    );

    expect(screen.getByText('Ya hay un cliente registrado con ese RUC.')).toBeInTheDocument();
    expect(screen.getByLabelText('RUC')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('No se pudo registrar el cliente.')).toBeInTheDocument();
  });

  it('el error del servidor de un campo se limpia cuando se corrige', () => {
    render(
      <NuevoClientePage
        giros={GIROS}
        erroresServidor={{ ruc: 'Ya hay un cliente registrado con ese RUC.' }}
        onRegistrar={() => {}}
        onCancelar={() => {}}
      />,
    );

    escribir('RUC', '20611122234');

    expect(screen.queryByText('Ya hay un cliente registrado con ese RUC.')).not.toBeInTheDocument();
  });

  it('mientras se guarda deshabilita los botones y cambia el texto', () => {
    render(<NuevoClientePage giros={GIROS} enviando onRegistrar={() => {}} onCancelar={() => {}} />);

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});

describe('NuevoClientePage — edición de la ficha', () => {
  it('carga los datos y deja fijos el RUC y el código corto', () => {
    render(<NuevoClientePage giros={GIROS} inicial={existente} anticipacionInicial={45} onRegistrar={() => {}} onCancelar={() => {}} />);

    expect(screen.getByLabelText('RUC')).toBeDisabled();
    expect(screen.getByLabelText('RUC')).toHaveValue('20512345678');
    expect(screen.getByLabelText('Código corto')).toBeDisabled();
    expect(screen.getByLabelText('Código corto')).toHaveValue('KALLPA');
    expect(screen.getByLabelText('Avisar el vencimiento del certificado con')).toHaveValue('45');
    expect(screen.getByRole('radiogroup', { name: 'Estado' })).toBeInTheDocument();
  });

  it('guarda los cambios y puede cambiar el estado', () => {
    const onRegistrar = vi.fn();
    render(<NuevoClientePage giros={GIROS} inicial={existente} onRegistrar={onRegistrar} onCancelar={() => {}} />);

    escribir('Razón social', 'Kallpa Energía S.A.C.');
    fireEvent.click(screen.getByRole('radio', { name: 'Inactivo' }));
    enviar('Guardar ficha');

    expect(onRegistrar.mock.calls[0][0]).toMatchObject({ razonSocial: 'Kallpa Energía S.A.C.', ruc: '20512345678', estado: 'INACTIVO' });
  });

  it('conserva un giro que ya no está en el catálogo para no perderlo al guardar', () => {
    render(<NuevoClientePage giros={GIROS} inicial={{ ...existente, giro: 'Minería' }} onRegistrar={() => {}} onCancelar={() => {}} />);

    expect(screen.getByLabelText('Giro del negocio')).toHaveValue('Minería');
  });

  it('un valor de anticipación fuera de la lista se conserva como opción', () => {
    render(<NuevoClientePage giros={GIROS} inicial={existente} anticipacionInicial={20} onRegistrar={() => {}} onCancelar={() => {}} />);

    expect(screen.getByLabelText('Avisar el vencimiento del certificado con')).toHaveValue('20');
  });
});
