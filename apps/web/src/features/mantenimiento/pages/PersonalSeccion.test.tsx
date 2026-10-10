import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersonalSeccion } from './PersonalSeccion';
import { useSesion } from '../../../shared/api/sesion';
import { crearEstadoApi, json, llamadasA, personalApi, simularApiMantenimiento } from '../pruebas/api-mantenimiento-simulada';

const fetchMock = vi.fn();
const onNuevo = vi.fn();
const onEditar = vi.fn();

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PersonalSeccion onNuevo={onNuevo} onEditar={onEditar} />
    </QueryClientProvider>,
  );
}

describe('PersonalSeccion', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    onNuevo.mockReset();
    onEditar.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra el personal con nombre completo y cargo con su etiqueta', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ personal: [personalApi(1, { nombres: 'Marco', apellidos: 'Ipusari', usuario: 'M.IPUSARI' })] }));
    montar();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando personal…');
    const fila = (await screen.findByText('Marco Ipusari')).closest('tr') as HTMLElement;
    expect(within(fila).getByText('Técnico Operador')).toBeInTheDocument();
    expect(within(fila).getByText('M.IPUSARI')).toBeInTheDocument();
    expect(within(fila).getByText('Activo')).toBeInTheDocument();
  });

  it('explica que la clave la asigna el administrador del sistema', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi());
    montar();
    expect(await screen.findByText(/La clave de acceso la asigna el administrador del sistema/)).toBeInTheDocument();
  });

  it('sin personal invita a registrar a la primera persona', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi());
    montar();
    expect(await screen.findByText('Todavía no hay personal registrado.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva persona' }));
    expect(onNuevo).toHaveBeenCalled();
  });

  it('un 403 muestra un aviso de permiso claro', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ rol: 'SUPERVISOR' }));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver el personal.');
    expect(screen.queryByRole('button', { name: 'Nueva persona' })).toBeNull();
  });

  it('editar entrega la persona completa', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ personal: [personalApi(1)] }));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar a Nombre1 Apellido1' }));
    expect(onEditar).toHaveBeenCalledWith(expect.objectContaining({ dni: '40000001', cargo: 'TECNICO_OPERADOR' }));
  });

  it('desactiva y vuelve a activar a una persona', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ personal: [personalApi(1)] }));
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar a Nombre1 Apellido1' }));
    expect(await screen.findByRole('button', { name: 'Activar a Nombre1 Apellido1' })).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'PATCH')[0].url).toMatch(/\/personal\/22222222-0000-4000-8000-000000000001\/desactivar$/);

    fireEvent.click(screen.getByRole('button', { name: 'Activar a Nombre1 Apellido1' }));
    expect(await screen.findByRole('button', { name: 'Desactivar a Nombre1 Apellido1' })).toBeInTheDocument();
  });

  it('si el cambio de estado falla lo avisa sin perder la lista', async () => {
    simularApiMantenimiento(fetchMock, crearEstadoApi({ personal: [personalApi(1)] }));
    const lectura = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'PATCH' ? json(409, { statusCode: 409, message: 'No se puede desactivar' }) : lectura(url, init),
    );
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar a Nombre1 Apellido1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede desactivar');
    expect(screen.getByText('Nombre1 Apellido1')).toBeInTheDocument();
  });
});
