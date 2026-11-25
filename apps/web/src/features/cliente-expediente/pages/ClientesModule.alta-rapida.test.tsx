import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientesModule } from './ClientesModule';
import { CarteraProvider } from '../model/cartera-context';
import { AuditoriaProvider } from '../../auditoria/model/auditoria-context';
import { ProgramacionProvider } from '../../programacion/model/programacion-context';
import { useSesion } from '../../../shared/api/sesion';
import type { Rol } from '../../auth/model/roles';
import { cuerpoDe, estadoSoloCliente, llamadasA, simularApiExpediente, type EstadoSimulado } from '../pruebas/api-expediente-simulada';

const fetchMock = vi.fn();

interface Opciones {
  rol?: Rol;
  iniciarEnAltaRapida?: boolean;
  onProgramarVisita?: () => void;
}

function montar(estado: EstadoSimulado, { rol = 'ADMINISTRADOR', iniciarEnAltaRapida, onProgramarVisita = () => {} }: Opciones = {}) {
  simularApiExpediente(fetchMock, estado);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditoriaProvider>
        <CarteraProvider>
          <ProgramacionProvider>
            <ClientesModule
              usuario="r.agarate"
              rol={rol}
              onAbrirMapaMurino={() => {}}
              onProgramarVisita={onProgramarVisita}
              iniciarEnAltaRapida={iniciarEnAltaRapida}
            />
          </ProgramacionProvider>
        </CarteraProvider>
      </AuditoriaProvider>
    </QueryClientProvider>,
  );
}

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

/** Cuenta los clics en botones que no son de llenar datos (los de guardar cada paso sí cuentan). */
let clics = 0;
function pulsar(boton: HTMLElement) {
  clics += 1;
  fireEvent.click(boton);
}

const pasoActual = () => screen.getByRole('navigation', { name: 'Alta rápida de cliente' });

async function llenarCliente() {
  await waitFor(() => expect(within(screen.getByLabelText('Giro del negocio')).getByRole('option', { name: 'Alimentos' })).toBeInTheDocument());
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

function llenarSede() {
  escribir('Nombre del proyecto', 'planta norte');
  escribir('Dirección de la sede', 'Parque Industrial Mz. B');
  escribir('Distrito', 'Cerro Colorado');
  escribir('Nombre', 'Luis Rojas');
  escribir('Cargo', 'Jefe de Planta');
  escribir('Teléfono', '054 223344');
}

async function llenarServicio(tipo = 'DSF') {
  escribir('Tipo de servicio', tipo);
  escribir('Frecuencia', 'MENSUAL');
  escribir('Área total del local', '1200');
  escribir('Área a tratar por visita', '800');
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Brodifacoum 0.005%' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Aspersora de mochila' }));
  fireEvent.click(screen.getByRole('radio', { name: 'No' }));
}

/** Recorre los tres pasos desde la cartera y deja la pantalla en el resumen. */
async function recorrerAlta() {
  pulsar(await screen.findByRole('button', { name: 'Nuevo cliente' }));
  await llenarCliente();
  pulsar(screen.getByRole('button', { name: 'Registrar cliente' }));
  await screen.findByRole('heading', { name: 'Nueva sede' });
  llenarSede();
  pulsar(screen.getByRole('button', { name: 'Registrar sede' }));
  await screen.findByRole('heading', { name: 'Nuevo servicio' });
  await llenarServicio();
  pulsar(screen.getByRole('button', { name: 'Registrar servicio' }));
  await screen.findByRole('heading', { name: 'Alta completada' });
}

describe('alta rápida encadenada: cliente → sede → servicio → resumen (GAF-99)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
    clics = 0;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('cada paso muestra su indicador y, al guardar, pasa directo al siguiente con lo recién creado', async () => {
    montar(estadoSoloCliente());
    pulsar(await screen.findByRole('button', { name: 'Nuevo cliente' }));
    expect(pasoActual()).toHaveTextContent('Paso 1 de 3');
    expect(within(pasoActual()).getByText('Cliente')).toHaveAttribute('aria-current', 'step');

    await llenarCliente();
    pulsar(screen.getByRole('button', { name: 'Registrar cliente' }));

    expect(await screen.findByRole('heading', { name: 'Nueva sede' })).toBeInTheDocument();
    expect(pasoActual()).toHaveTextContent('Paso 2 de 3');
    expect(screen.getByText(/Cliente MOLISUR registrado/)).toHaveAttribute('role', 'status');
    const clienteCreado = cuerpoDe(llamadasA(fetchMock, 'POST', '/clientes')[0]) as { codigoCorto: string };
    expect(clienteCreado.codigoCorto).toBe('MOLISUR');

    llenarSede();
    pulsar(screen.getByRole('button', { name: 'Registrar sede' }));

    expect(await screen.findByRole('heading', { name: 'Nuevo servicio' })).toBeInTheDocument();
    expect(pasoActual()).toHaveTextContent('Paso 3 de 3');
    expect(screen.getByText(/Sede PLANTA_NORTE registrada/)).toHaveAttribute('role', 'status');
    const sedeCreada = cuerpoDe(llamadasA(fetchMock, 'POST', '/proyectos')[0]) as { clienteId: string };
    expect(sedeCreada.clienteId).toMatch(/^aaaaaaaa-/);

    await llenarServicio();
    pulsar(screen.getByRole('button', { name: 'Registrar servicio' }));

    expect(await screen.findByRole('heading', { name: 'Alta completada' })).toBeInTheDocument();
    const servicioCreado = cuerpoDe(llamadasA(fetchMock, 'POST', '/servicios-contratados')[0]) as { proyectoId: string };
    expect(servicioCreado.proyectoId).toMatch(/^aaaaaaaa-/);
    // Fuera de llenar datos: «Nuevo cliente» y un «Registrar» por paso.
    expect(clics).toBeLessThanOrEqual(4);
  });

  it('el resumen muestra lo registrado y ofrece agregar otro servicio, ver el expediente y programar una visita', async () => {
    const onProgramarVisita = vi.fn();
    montar(estadoSoloCliente(), { onProgramarVisita });
    await recorrerAlta();

    const resumen = screen.getByRole('region', { name: 'Resumen del alta' });
    expect(within(resumen).getByText('Molinos del Sur S.A.C.')).toBeInTheDocument();
    expect(within(resumen).getByText('PLANTA_NORTE')).toBeInTheDocument();
    expect(within(resumen).getByText(/DSF — Desinfección/)).toBeInTheDocument();
    expect(within(resumen).getByText('Programado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Programar visita' }));
    expect(onProgramarVisita).toHaveBeenCalledTimes(1);
  });

  it('«Agregar otro servicio» vuelve al paso 3 en la misma sede y el resumen suma el nuevo servicio', async () => {
    montar(estadoSoloCliente());
    await recorrerAlta();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro servicio' }));
    expect(await screen.findByRole('heading', { name: 'Nuevo servicio' })).toBeInTheDocument();
    expect(pasoActual()).toHaveTextContent('Paso 3 de 3');
    await llenarServicio('DSS');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    const resumen = await screen.findByRole('region', { name: 'Resumen del alta' });
    await waitFor(() => expect(within(resumen).getByText(/DSS — Desinsectación/)).toBeInTheDocument());
    expect(within(resumen).getByText(/DSF — Desinfección/)).toBeInTheDocument();
    const proyectos = llamadasA(fetchMock, 'POST', '/servicios-contratados').map((l) => (cuerpoDe(l) as { proyectoId: string }).proyectoId);
    expect(new Set(proyectos).size).toBe(1);
  });

  it('«Ver expediente» abre la ficha del cliente nuevo con su sede y el servicio programado', async () => {
    montar(estadoSoloCliente());
    await recorrerAlta();

    fireEvent.click(screen.getByRole('button', { name: 'Ver expediente' }));

    expect(await screen.findByRole('heading', { name: 'Ficha del cliente' })).toBeInTheDocument();
    const sede = (await screen.findByText('PLANTA_NORTE')).closest('li') as HTMLElement;
    expect(within(sede).getByLabelText('Estado de la sede')).toHaveTextContent('Programado');
  });

  it('salir en el paso 1 vuelve a la cartera sin registrar nada', async () => {
    montar(estadoSoloCliente());
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));

    fireEvent.click(screen.getByRole('button', { name: 'Salir del alta rápida' }));

    expect(await screen.findByRole('heading', { name: 'Cartera de clientes' })).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'POST')).toHaveLength(0);
  });

  it('salir en el paso 2 deja el cliente guardado y abre su expediente', async () => {
    montar(estadoSoloCliente());
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));
    await llenarCliente();
    escribir('Avisar el vencimiento del certificado con', '60');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));
    await screen.findByRole('heading', { name: 'Nueva sede' });

    fireEvent.click(screen.getByRole('button', { name: 'Salir del alta rápida' }));

    expect(await screen.findByRole('heading', { name: 'Ficha del cliente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Molinos del Sur S.A.C.' })).toBeInTheDocument();
    expect(screen.getByText('60 días antes')).toBeInTheDocument();
    expect(await screen.findByText(/Este cliente todavía no tiene sedes/)).toBeInTheDocument();
  });

  it('cancelar el formulario del paso 3 deja la sede guardada y abre el expediente', async () => {
    montar(estadoSoloCliente());
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));
    await llenarCliente();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));
    await screen.findByRole('heading', { name: 'Nueva sede' });
    llenarSede();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sede' }));
    await screen.findByRole('heading', { name: 'Nuevo servicio' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { name: 'Ficha del cliente' })).toBeInTheDocument();
    expect(await screen.findByText('PLANTA_NORTE')).toBeInTheDocument();
    expect(llamadasA(fetchMock, 'POST', '/servicios-contratados')).toHaveLength(0);
  });

  it('un error del servidor en un paso queda en el formulario y no avanza', async () => {
    const estado = estadoSoloCliente();
    montar(estado);
    const base = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      String(url).endsWith('/proyectos') && init?.method === 'POST'
        ? new Response(JSON.stringify({ statusCode: 400, message: 'x', errors: [{ path: 'distrito', message: 'Distrito no reconocido' }] }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        : base(url, init),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));
    await llenarCliente();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));
    await screen.findByRole('heading', { name: 'Nueva sede' });
    llenarSede();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sede' }));

    expect(await screen.findByText('Distrito no reconocido')).toBeInTheDocument();
    expect(pasoActual()).toHaveTextContent('Paso 2 de 3');
  });

  it('puede empezar directo en el paso 1 (acceso desde el panel de control)', async () => {
    montar(estadoSoloCliente(), { iniciarEnAltaRapida: true });

    expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument();
    expect(pasoActual()).toHaveTextContent('Paso 1 de 3');
  });

  it('el Supervisor no ve el acceso ni puede empezar el alta', async () => {
    montar(estadoSoloCliente(), { rol: 'SUPERVISOR', iniciarEnAltaRapida: true });

    expect(await screen.findByRole('heading', { name: 'Cartera de clientes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Alta rápida de cliente' })).not.toBeInTheDocument();
  });
});
