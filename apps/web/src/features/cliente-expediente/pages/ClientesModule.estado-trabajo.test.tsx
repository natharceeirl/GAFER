import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientesModule } from './ClientesModule';
import { CarteraProvider } from '../model/cartera-context';
import { AuditoriaProvider } from '../../auditoria/model/auditoria-context';
import { ProgramacionProvider } from '../../programacion/model/programacion-context';
import { useSesion } from '../../../shared/api/sesion';
import type { Rol } from '../../auth/model/roles';
import {
  SERVICIO_ID,
  cuerpoDe,
  estadoConServicios,
  llamadasA,
  servicioEjemplo,
  simularApiExpediente,
  type EstadoSimulado,
} from '../pruebas/api-expediente-simulada';

const fetchMock = vi.fn();
const RUTA_ESTADO = `/servicios-contratados/${SERVICIO_ID}/estado`;

function montar(rol: Rol = 'ADMINISTRADOR') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditoriaProvider>
        <CarteraProvider>
          <ProgramacionProvider>
            <ClientesModule usuario="r.agarate" rol={rol} onAbrirMapaMurino={() => {}} />
          </ProgramacionProvider>
        </CarteraProvider>
      </AuditoriaProvider>
    </QueryClientProvider>,
  );
}

async function abrirExpediente(estado: EstadoSimulado, rol: Rol = 'ADMINISTRADOR') {
  simularApiExpediente(fetchMock, estado);
  montar(rol);
  fireEvent.click(await screen.findByRole('button', { name: /Kallpa Energía S\.A\./ }));
  return (await screen.findByText('PLANTA_NORTE')).closest('li') as HTMLElement;
}

const servicioDe = (sede: HTMLElement) => within(sede).getByText(/DRT — Desratización/).closest('li') as HTMLElement;

describe('expediente: estado de trabajo de cada servicio y estado derivado de la sede (GAF-99)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra la insignia del servicio y la del estado de la sede con las etiquetas de pantalla', async () => {
    const sede = await abrirExpediente(estadoConServicios([servicioEjemplo({ estadoTrabajo: 'EJECUTADO' })]));

    expect(within(servicioDe(sede)).getByText('Ejecutado')).toBeInTheDocument();
    expect(within(sede).getByLabelText('Estado de la sede')).toHaveTextContent('Ejecutado');
  });

  it('un servicio programado con la fecha vencida se muestra Pendiente, en el servicio y en la sede, y aún se puede marcar ejecutado', async () => {
    const sede = await abrirExpediente(
      estadoConServicios([servicioEjemplo({ estadoTrabajo: 'PROGRAMADO', fechaProgramada: '2020-01-15' })]),
    );

    expect(within(servicioDe(sede)).getByText('Pendiente')).toBeInTheDocument();
    expect(within(sede).getByLabelText('Estado de la sede')).toHaveTextContent('Pendiente');
    expect(within(sede).getByRole('button', { name: 'Marcar ejecutado servicio DRT en PLANTA_NORTE' })).toBeInTheDocument();
    expect(within(sede).queryByRole('button', { name: /pendiente/i })).not.toBeInTheDocument();
  });

  it('un servicio programado con fecha futura sigue Programado', async () => {
    const sede = await abrirExpediente(
      estadoConServicios([servicioEjemplo({ estadoTrabajo: 'PROGRAMADO', fechaProgramada: '2099-01-15' })]),
    );
    expect(within(servicioDe(sede)).getByText('Programado')).toBeInTheDocument();
  });

  it('el Administrador marca ejecutado un servicio programado con un clic y la sede pasa a ejecutado', async () => {
    const estado = estadoConServicios();
    const sede = await abrirExpediente(estado);
    expect(within(sede).getByLabelText('Estado de la sede')).toHaveTextContent('Programado');

    fireEvent.click(within(sede).getByRole('button', { name: 'Marcar ejecutado servicio DRT en PLANTA_NORTE' }));

    await waitFor(() => expect(within(screen.getByText('PLANTA_NORTE').closest('li') as HTMLElement).getByLabelText('Estado de la sede')).toHaveTextContent('Ejecutado'));
    expect(cuerpoDe(llamadasA(fetchMock, 'PATCH', RUTA_ESTADO)[0])).toEqual({ estado: 'EJECUTADO' });
    const actual = servicioDe(screen.getByText('PLANTA_NORTE').closest('li') as HTMLElement);
    expect(within(actual).getByRole('button', { name: 'Marcar concluido servicio DRT en PLANTA_NORTE' })).toBeInTheDocument();
  });

  it('marca concluido un servicio ejecutado', async () => {
    const sede = await abrirExpediente(estadoConServicios([servicioEjemplo({ estadoTrabajo: 'EJECUTADO' })]));

    fireEvent.click(within(sede).getByRole('button', { name: 'Marcar concluido servicio DRT en PLANTA_NORTE' }));

    await waitFor(() => expect(llamadasA(fetchMock, 'PATCH', RUTA_ESTADO)).toHaveLength(1));
    expect(cuerpoDe(llamadasA(fetchMock, 'PATCH', RUTA_ESTADO)[0])).toEqual({ estado: 'CONCLUIDO' });
    expect(await screen.findByRole('button', { name: 'Reabrir servicio DRT en PLANTA_NORTE' })).toBeInTheDocument();
  });

  it('cancelar pide confirmación con motivo obligatorio; sin motivo no envía nada', async () => {
    const sede = await abrirExpediente(estadoConServicios());

    fireEvent.click(within(sede).getByRole('button', { name: 'Cancelar servicio DRT en PLANTA_NORTE' }));
    const dialogo = screen.getByRole('dialog', { name: 'Cancelar servicio DRT en PLANTA_NORTE' });
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: ' abc ' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar cancelación' }));

    expect(within(dialogo).getByText('Indique un motivo de al menos 5 caracteres.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true');
    expect(llamadasA(fetchMock, 'PATCH')).toHaveLength(0);

    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: 'El cliente suspendió el contrato' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar cancelación' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cuerpoDe(llamadasA(fetchMock, 'PATCH', RUTA_ESTADO)[0])).toEqual({ estado: 'CANCELADO', motivo: 'El cliente suspendió el contrato' });
    const actual = screen.getByText('PLANTA_NORTE').closest('li') as HTMLElement;
    expect(within(actual).getByLabelText('Estado de la sede')).toHaveTextContent('Cancelado');
    expect(within(actual).getByRole('button', { name: 'Reabrir servicio DRT en PLANTA_NORTE' })).toBeInTheDocument();
  });

  it('volver cierra el diálogo sin cambiar nada', async () => {
    const sede = await abrirExpediente(estadoConServicios());

    fireEvent.click(within(sede).getByRole('button', { name: 'Cancelar servicio DRT en PLANTA_NORTE' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(llamadasA(fetchMock, 'PATCH')).toHaveLength(0);
  });

  it('reabre un servicio concluido con motivo', async () => {
    const sede = await abrirExpediente(estadoConServicios([servicioEjemplo({ estadoTrabajo: 'CONCLUIDO' })]));
    expect(within(sede).getByLabelText('Estado de la sede')).toHaveTextContent('Concluido');

    fireEvent.click(within(sede).getByRole('button', { name: 'Reabrir servicio DRT en PLANTA_NORTE' }));
    const dialogo = screen.getByRole('dialog', { name: 'Reabrir servicio DRT en PLANTA_NORTE' });
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: 'Faltó tratar el almacén' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar reapertura' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cuerpoDe(llamadasA(fetchMock, 'PATCH', RUTA_ESTADO)[0])).toEqual({ estado: 'EJECUTADO', motivo: 'Faltó tratar el almacén' });
    expect(within(screen.getByText('PLANTA_NORTE').closest('li') as HTMLElement).getByLabelText('Estado de la sede')).toHaveTextContent('Ejecutado');
  });

  it('un error del servidor en el motivo se marca en el campo y el diálogo queda abierto', async () => {
    const estado = estadoConServicios();
    estado.errorMotivo = 'El motivo no puede ser solo números';
    const sede = await abrirExpediente(estado);

    fireEvent.click(within(sede).getByRole('button', { name: 'Cancelar servicio DRT en PLANTA_NORTE' }));
    const dialogo = screen.getByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: '123456' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar cancelación' }));

    expect(await within(dialogo).findByText('El motivo no puede ser solo números')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un error general del servidor (transición rechazada) se muestra sobre las sedes', async () => {
    const estado = estadoConServicios();
    const sede = await abrirExpediente(estado);
    estado.servicios[0].estadoTrabajo = 'EJECUTADO';

    fireEvent.click(within(sede).getByRole('button', { name: 'Marcar ejecutado servicio DRT en PLANTA_NORTE' }));

    expect(await screen.findByText(/No se puede pasar el servicio de EJECUTADO a EJECUTADO/)).toBeInTheDocument();
  });

  it('el Supervisor ve las insignias pero ningún botón de estado de trabajo', async () => {
    const sede = await abrirExpediente(estadoConServicios([servicioEjemplo({ estadoTrabajo: 'EJECUTADO' })]), 'SUPERVISOR');

    expect(within(sede).getByLabelText('Estado de la sede')).toHaveTextContent('Ejecutado');
    expect(within(servicioDe(sede)).getByText('Ejecutado')).toBeInTheDocument();
    for (const accion of ['Marcar ejecutado', 'Marcar concluido', 'Cancelar', 'Reabrir']) {
      expect(screen.queryByRole('button', { name: `${accion} servicio DRT en PLANTA_NORTE` })).not.toBeInTheDocument();
    }
  });

  it('un servicio dado de baja muestra su estado pero no ofrece cambiarlo, ni cuenta para el estado de la sede', async () => {
    const sede = await abrirExpediente(
      estadoConServicios([
        servicioEjemplo({ estado: 'INACTIVO', estadoTrabajo: 'EJECUTADO' }),
        servicioEjemplo({ id: 'bbbbbbbb-0000-4000-8000-000000000001', tipoServicio: 'DSF', estadoTrabajo: 'PROGRAMADO' }),
      ]),
    );

    expect(within(sede).getByLabelText('Estado de la sede')).toHaveTextContent('Programado');
    expect(within(sede).queryByRole('button', { name: 'Marcar concluido servicio DRT en PLANTA_NORTE' })).not.toBeInTheDocument();
    expect(within(sede).getByRole('button', { name: 'Marcar ejecutado servicio DSF en PLANTA_NORTE' })).toBeInTheDocument();
  });
});
