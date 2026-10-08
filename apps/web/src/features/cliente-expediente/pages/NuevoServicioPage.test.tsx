import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NuevoServicioPage } from './NuevoServicioPage';
import { CLIENTES_MOCK } from '../model/clientes-mock';
import type { ProyectoExpediente } from '../model/proyecto-mapper';
import type { DatosServicio } from '../model/validaciones';
import { equipoDePrueba, insumoDePrueba } from '../../mantenimiento/pruebas/fabricas';

const cliente = CLIENTES_MOCK[0];

const proyecto: ProyectoExpediente = {
  id: 'p1',
  clienteId: cliente.id,
  nombre: 'PLANTA_NORTE',
  direccion: 'Parque Industrial',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  observaciones: '',
  estado: 'ACTIVO',
  servicios: [],
};

const insumos = [
  insumoDePrueba({ id: 'i1', nombreComercial: 'Brodifacoum', dosisEstandar: '1 bloque por estación' }),
  insumoDePrueba({ id: 'i2', nombreComercial: 'Cloro', principioActivo: 'Hipoclorito', presentacion: 'LIQUIDO', concentracion: '5%', registroDigesa: 'DIG-2', dosisEstandar: '50 ppm' }),
  insumoDePrueba({ id: 'i9', nombreComercial: 'Retirado', registroDigesa: 'DIG-9', dosisEstandar: '1 ml', estado: 'INACTIVO' }),
];

const equipos = [
  equipoDePrueba({ id: 'e1', nombre: 'Aspersora', codigoInterno: 'EQ-022', tipo: 'ASPERSION' }),
  equipoDePrueba({ id: 'e2', nombre: 'Nebulizadora', codigoInterno: 'EQ-007', tipo: 'NEBULIZACION', estadoOperativo: 'FUERA_SERVICIO' }),
];

const existente: DatosServicio = {
  tipo: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotal: '1200',
  areaTratar: '800',
  insumos: ['i1'],
  dosis: { i1: '2 bloques por estación' },
  equipos: ['e1'],
  requiereCertificado: true,
  vigenciaDias: '180',
};

const propsBase = { cliente, proyecto, insumos, equipos, onRegistrar: () => {}, onCancelar: () => {} };

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function completarAlta() {
  escribir('Tipo de servicio', 'DRT');
  escribir('Frecuencia', 'QUINCENAL');
  escribir('Área total del local', '1200');
  escribir('Área a tratar por visita', '800');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Brodifacoum' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Aspersora' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
  escribir('Vigencia del certificado', '180');
}

describe('NuevoServicioPage — alta de servicio', () => {
  it('con datos válidos entrega el servicio con códigos del contrato y la dosis precargada del catálogo', () => {
    const onRegistrar = vi.fn();
    render(<NuevoServicioPage {...propsBase} onRegistrar={onRegistrar} />);
    completarAlta();
    expect(screen.getByLabelText('Dosis referencial para este servicio')).toHaveValue('1 bloque por estación');
    expect(screen.queryByRole('checkbox', { name: 'Retirado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Inactivo' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    expect(onRegistrar).toHaveBeenCalledWith({
      tipo: 'DRT',
      frecuencia: 'QUINCENAL',
      areaTotal: '1200',
      areaTratar: '800',
      insumos: ['i1'],
      dosis: { i1: '1 bloque por estación' },
      equipos: ['e1'],
      requiereCertificado: true,
      vigenciaDias: '180',
    });
  });

  it('muestra la regla cruzada del esquema (área a tratar mayor al total) en el campo del área a tratar', () => {
    const onRegistrar = vi.fn();
    render(<NuevoServicioPage {...propsBase} onRegistrar={onRegistrar} />);
    completarAlta();
    escribir('Área a tratar por visita', '1500');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    expect(onRegistrar).not.toHaveBeenCalled();
    expect(screen.getByText('No puede superar el área total del local')).toBeInTheDocument();
    expect(screen.getByLabelText('Área a tratar por visita')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Área total del local')).not.toHaveAttribute('aria-invalid');
  });

  it('pide la vigencia en días cuando requiere certificado y la oculta cuando no', () => {
    render(<NuevoServicioPage {...propsBase} />);
    completarAlta();
    escribir('Vigencia del certificado', '');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    expect(screen.getByLabelText('Vigencia del certificado')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    expect(screen.queryByLabelText('Vigencia del certificado')).not.toBeInTheDocument();
  });

  it('muestra los errores del servidor en su campo y los quita al corregirlo', () => {
    const { rerender } = render(<NuevoServicioPage {...propsBase} />);
    completarAlta();
    rerender(
      <NuevoServicioPage
        {...propsBase}
        erroresServidor={{ areaTratar: 'No puede superar el área total del local', vigenciaDias: 'Vigencia rechazada' }}
        errorGeneral="Los datos enviados no son válidos."
      />,
    );

    expect(screen.getByText('Vigencia rechazada')).toBeInTheDocument();
    expect(screen.getByLabelText('Área a tratar por visita')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Los datos enviados no son válidos.')).toBeInTheDocument();

    escribir('Vigencia del certificado', '90');
    expect(screen.queryByText('Vigencia rechazada')).not.toBeInTheDocument();
  });

  it('mientras guarda deshabilita los botones', () => {
    render(<NuevoServicioPage {...propsBase} enviando />);

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });

  it('no deja asignar un equipo fuera de servicio', () => {
    render(<NuevoServicioPage {...propsBase} />);
    expect(screen.getByRole('checkbox', { name: 'Nebulizadora' })).toBeDisabled();
  });
});

describe('NuevoServicioPage — edición de servicio', () => {
  it('precarga el servicio, deja fijo el tipo y entrega lo editado', () => {
    const onRegistrar = vi.fn();
    render(<NuevoServicioPage {...propsBase} inicial={existente} onRegistrar={onRegistrar} />);

    expect(screen.getByRole('heading', { name: 'Editar servicio' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de servicio')).toBeDisabled();
    expect(screen.getByLabelText('Tipo de servicio')).toHaveValue('DRT');
    expect(screen.getByLabelText('Dosis referencial para este servicio')).toHaveValue('2 bloques por estación');

    escribir('Frecuencia', 'MENSUAL');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar servicio' }));

    expect(onRegistrar).toHaveBeenCalledWith({ ...existente, frecuencia: 'MENSUAL' });
  });

  it('muestra un insumo ya elegido que el catálogo marca inactivo, para poder quitarlo', () => {
    render(<NuevoServicioPage {...propsBase} inicial={{ ...existente, insumos: ['i9'], dosis: { i9: '1 ml' } }} />);

    expect(screen.getByRole('checkbox', { name: 'Retirado' })).toBeChecked();
  });
});

describe('NuevoServicioPage — catálogos de insumos y equipos', () => {
  it('mientras cargan avisa y no muestra listas', () => {
    render(<NuevoServicioPage {...propsBase} insumos={[]} equipos={[]} cargandoCatalogos />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando el catálogo de insumos y equipos…');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('si el catálogo no se puede leer (403) avisa, ofrece reintentar y no rompe el formulario', () => {
    const onReintentar = vi.fn();
    render(
      <NuevoServicioPage
        {...propsBase}
        insumos={[]}
        equipos={[]}
        errorCatalogos="No tiene permiso para realizar esta acción."
        onReintentarCatalogos={onReintentar}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo de insumos y equipos. No tiene permiso para realizar esta acción.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Tipo de servicio')).toBeInTheDocument();
  });

  it('en edición sin catálogo muestra los insumos y equipos ya asignados por su identificador', () => {
    render(
      <NuevoServicioPage
        {...propsBase}
        insumos={[]}
        equipos={[]}
        errorCatalogos="No tiene permiso para realizar esta acción."
        inicial={{ ...existente, insumos: ['0a1b2c3d-0000-4000-8000-000000000001'], dosis: { '0a1b2c3d-0000-4000-8000-000000000001': '1 bloque' }, equipos: ['9f8e7d6c-0000-4000-8000-000000000002'] }}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Insumo 0a1b2c3d' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Equipo 9f8e7d6c' })).toBeChecked();
  });
});
