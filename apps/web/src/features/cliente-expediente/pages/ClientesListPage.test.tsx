import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ClientesListPage } from './ClientesListPage';
import type { ClienteListado } from '../model/cliente-mapper';

const clientes: ClienteListado[] = [
  { id: 'a', codigoCorto: 'KALLPA', razonSocial: 'Kallpa Energía S.A.', ruc: '20512345678', giro: 'Energía', ultimoServicio: null, proximoVencimiento: null, estado: 'ACTIVO' },
  { id: 'b', codigoCorto: 'PLASTIQ', razonSocial: 'Plastiq Industrial S.A.', ruc: '20567123489', giro: 'Construcción', ultimoServicio: null, proximoVencimiento: null, estado: 'INACTIVO' },
];

function montar(props: Partial<React.ComponentProps<typeof ClientesListPage>> = {}) {
  const onAbrirCliente = vi.fn();
  const onReintentar = vi.fn();
  const onNuevoCliente = vi.fn();
  render(
    <ClientesListPage
      clientes={clientes}
      cargando={false}
      error={null}
      onReintentar={onReintentar}
      onAbrirCliente={onAbrirCliente}
      puedeCrearCliente
      onNuevoCliente={onNuevoCliente}
      {...props}
    />,
  );
  return { onAbrirCliente, onReintentar, onNuevoCliente };
}

describe('ClientesListPage', () => {
  it('lista los clientes y abre la ficha al elegir uno', () => {
    const { onAbrirCliente } = montar();

    fireEvent.click(screen.getByRole('button', { name: /Kallpa Energía S\.A\./ }));

    expect(onAbrirCliente).toHaveBeenCalledWith(clientes[0]);
    expect(screen.getByText('INACTIVO')).toBeInTheDocument();
  });

  it('muestra “—” donde el API no entrega último servicio ni vencimiento', () => {
    montar({ clientes: [clientes[0]] });

    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('mientras carga muestra un estado de carga y no la tabla vacía', () => {
    montar({ clientes: [], cargando: true });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando clientes…');
    expect(screen.queryByText(/Aún no hay clientes/)).not.toBeInTheDocument();
  });

  it('si falla, muestra el error y permite reintentar', () => {
    const { onReintentar } = montar({ clientes: [], error: 'No se pudo conectar con el servidor.' });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('sin clientes registrados lo dice, distinto de una búsqueda sin resultados', () => {
    montar({ clientes: [] });
    expect(screen.getByText('Aún no hay clientes registrados.')).toBeInTheDocument();
  });

  it('una búsqueda sin coincidencias lo indica', () => {
    montar();

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'zzz' } });

    expect(screen.getByText(/Ningún cliente coincide con “zzz”/)).toBeInTheDocument();
  });

  it('el botón Nuevo cliente solo aparece si el rol puede crear', () => {
    montar({ puedeCrearCliente: false });
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
  });
});
