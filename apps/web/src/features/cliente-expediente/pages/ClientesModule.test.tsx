import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientesModule } from './ClientesModule';
import { CarteraProvider } from '../model/cartera-context';
import { AuditoriaProvider } from '../../auditoria/model/auditoria-context';
import { ProgramacionProvider } from '../../programacion/model/programacion-context';
import { useSesion } from '../../../shared/api/sesion';
import type { Rol } from '../../auth/model/roles';

const fetchMock = vi.fn();

const ID = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';

const resumen = {
  id: ID,
  razonSocial: 'Kallpa Energía S.A.',
  ruc: '20512345678',
  codigoCorto: 'KALLPA',
  estado: 'ACTIVO',
  giroNegocio: 'Energía',
  contactoNombre: 'Rosa Contreras',
  contactoTelefono: '959 214 380',
  contactoCorreo: 'rcontreras@kallpa.pe',
};

const detalle = {
  ...resumen,
  direccionFiscal: 'Av. Víctor Andrés Belaúnde 147',
  contactoCargo: 'Jefa de Planta',
  camposExtra: { anticipacionAlertaDias: 45 },
};

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

/** API simulada en memoria: lista, detalle, alta, edición y cambio de estado. */
function simularApi() {
  const clientes = [{ ...detalle }];
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const { pathname } = new URL(url);
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(init.body as string) : undefined;
    if (pathname === '/api/mantenimiento/catalogos-texto') {
      return json(200, [{ id: 'giros', titulo: 'Giros de negocio', items: ['Alimentos', 'Energía', 'Minería'], soloAdministrador: false }]);
    }
    if (pathname === '/api/mantenimiento/clientes' && metodo === 'GET') {
      return json(200, { total: clientes.length, limit: 100, offset: 0, items: clientes });
    }
    if (pathname === '/api/mantenimiento/clientes' && metodo === 'POST') {
      if (clientes.some((c) => c.ruc === cuerpo.ruc)) {
        return json(409, { statusCode: 409, message: `Ya existe un cliente registrado con el RUC: ${cuerpo.ruc}` });
      }
      const nuevo = { id: '9a1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a22', estado: 'ACTIVO', ...cuerpo, giroNegocio: cuerpo.giroNegocio };
      clientes.push(nuevo);
      return json(201, nuevo);
    }
    const coincidencia = pathname.match(/^\/api\/mantenimiento\/clientes\/([^/]+)(?:\/(activar|desactivar))?$/);
    const cliente = clientes.find((c) => c.id === coincidencia?.[1]);
    if (!coincidencia || !cliente) return json(404, { statusCode: 404, message: 'Cliente no encontrado' });
    if (metodo === 'GET') return json(200, cliente);
    if (coincidencia[2]) {
      cliente.estado = coincidencia[2] === 'activar' ? 'ACTIVO' : 'INACTIVO';
      return json(200, { id: cliente.id, estado: cliente.estado });
    }
    Object.assign(cliente, cuerpo, { camposExtra: { ...cliente.camposExtra, ...cuerpo.camposExtra } });
    return json(200, cliente);
  });
  return clientes;
}

function montar(rol: Rol = 'ADMINISTRADOR') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
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

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function llamadas(metodo: string) {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === metodo);
}

describe('ClientesModule conectado al API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lista los clientes del API y abre la ficha con la anticipación configurada', async () => {
    simularApi();
    montar();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando clientes…');
    fireEvent.click(await screen.findByRole('button', { name: /Kallpa Energía S\.A\./ }));

    expect(await screen.findByRole('heading', { name: 'Ficha del cliente' })).toBeInTheDocument();
    expect(screen.getByText('45 días antes')).toBeInTheDocument();
    expect(screen.getByText('Av. Víctor Andrés Belaúnde 147')).toBeInTheDocument();
  });

  it('si el listado falla muestra el error y reintentar lo vuelve a pedir', async () => {
    fetchMock.mockResolvedValueOnce(json(500, { statusCode: 500, message: 'Ocurrió un error interno en el servidor' }));
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/El servidor no pudo completar la operación/);
    simularApi();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: /Kallpa Energía S\.A\./ })).toBeInTheDocument();
  });

  it('da de alta un cliente real: envía el cuerpo del contrato y abre su expediente', async () => {
    simularApi();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));

    escribir('Razón social', 'Molinos del Sur S.A.C.');
    escribir('RUC', '20611122233');
    escribir('Código corto', 'molisur');
    escribir('Dirección fiscal', 'Av. Ejército 101');
    escribir('Giro del negocio', 'Alimentos');
    escribir('Nombre', 'Carla Pinto');
    escribir('Cargo', 'Jefa de Calidad');
    escribir('Teléfono', '959 123 456');
    escribir('Correo', 'cpinto@molisur.pe');
    escribir('Avisar el vencimiento del certificado con', '60');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));

    expect(await screen.findByText(/Cliente MOLISUR registrado/)).toBeInTheDocument();
    expect(JSON.parse(llamadas('POST')[0][1].body)).toEqual({
      razonSocial: 'Molinos del Sur S.A.C.',
      ruc: '20611122233',
      codigoCorto: 'MOLISUR',
      direccionFiscal: 'Av. Ejército 101',
      giroNegocio: 'Alimentos',
      contactoNombre: 'Carla Pinto',
      contactoCargo: 'Jefa de Calidad',
      contactoTelefono: '959 123 456',
      contactoCorreo: 'cpinto@molisur.pe',
      camposExtra: { anticipacionAlertaDias: 60 },
    });
    expect(screen.getByText('60 días antes')).toBeInTheDocument();
  });

  it('los giros del formulario salen del catálogo de texto del API, no de una lista fija', async () => {
    simularApi();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));

    await waitFor(() => expect(within(screen.getByLabelText('Giro del negocio')).getByRole('option', { name: 'Minería' })).toBeInTheDocument());
    const opciones = within(screen.getByLabelText('Giro del negocio')).getAllByRole('option').map((o) => o.textContent);
    expect(opciones).toEqual(['Seleccione un giro…', 'Alimentos', 'Energía', 'Minería']);
  });

  it('un RUC repetido (409) se marca en el campo y el formulario queda abierto', async () => {
    simularApi();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));
    escribir('Razón social', 'Otra Kallpa');
    escribir('RUC', '20512345678');
    escribir('Código corto', 'OTRA');
    escribir('Dirección fiscal', 'Av. 1');
    escribir('Giro del negocio', 'Energía');
    escribir('Nombre', 'A');
    escribir('Cargo', 'B');
    escribir('Teléfono', '959 123 456');
    escribir('Correo', 'a@b.pe');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));

    expect(await screen.findByText('Ya hay un cliente registrado con ese RUC.')).toBeInTheDocument();
    expect(screen.getByLabelText('RUC')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Registrar cliente' })).toBeEnabled();
  });

  it('edita la ficha sin tocar RUC ni código y desactiva al cliente', async () => {
    const clientes = simularApi();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Kallpa Energía S\.A\./ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Editar ficha' }));

    expect(screen.getByLabelText('RUC')).toBeDisabled();
    expect(screen.getByLabelText('Código corto')).toBeDisabled();
    escribir('Razón social', 'Kallpa Generación S.A.');
    escribir('Avisar el vencimiento del certificado con', '15');
    fireEvent.click(screen.getByRole('radio', { name: 'Inactivo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));

    expect(await screen.findByText('Ficha del cliente actualizada.')).toBeInTheDocument();
    const cuerpo = JSON.parse(llamadas('PATCH')[0][1].body);
    expect(cuerpo).not.toHaveProperty('ruc');
    expect(cuerpo).not.toHaveProperty('codigoCorto');
    expect(cuerpo).toMatchObject({ razonSocial: 'Kallpa Generación S.A.', camposExtra: { anticipacionAlertaDias: 15 } });
    expect(llamadas('PATCH')[1][0]).toMatch(/\/desactivar$/);
    expect(clientes[0]).toMatchObject({ estado: 'INACTIVO', razonSocial: 'Kallpa Generación S.A.' });
    const ficha = screen.getByRole('region', { name: 'Ficha del cliente' });
    expect(within(ficha).getByText('Inactivo')).toBeInTheDocument();
    expect(within(ficha).getByText('15 días antes')).toBeInTheDocument();
  });

  it('el Supervisor ve la cartera pero no puede crear clientes', async () => {
    simularApi();
    montar('SUPERVISOR');

    await screen.findByRole('button', { name: /Kallpa Energía S\.A\./ });
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
  });

  it('si no carga la ficha ofrece reintentar y volver', async () => {
    simularApi();
    montar();
    const fila = await screen.findByRole('button', { name: /Kallpa Energía S\.A\./ });
    fetchMock.mockResolvedValueOnce(json(500, { statusCode: 500, message: 'x' }));
    fireEvent.click(fila);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    simularApi();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ficha del cliente' })).toBeInTheDocument());
  });
});
