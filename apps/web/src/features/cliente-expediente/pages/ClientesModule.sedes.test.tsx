import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientesModule } from './ClientesModule';
import { CarteraProvider } from '../model/cartera-context';
import { AuditoriaProvider } from '../../auditoria/model/auditoria-context';
import { ProgramacionProvider } from '../../programacion/model/programacion-context';
import { useSesion } from '../../../shared/api/sesion';
import type { Rol } from '../../auth/model/roles';

const fetchMock = vi.fn();

const CLIENTE = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';
const INSUMO = '11111111-1111-4111-8111-111111111111';
const EQUIPO = '22222222-2222-4222-8222-222222222222';

const cliente = {
  id: CLIENTE,
  razonSocial: 'Kallpa Energía S.A.',
  ruc: '20512345678',
  codigoCorto: 'KALLPA',
  estado: 'ACTIVO',
  giroNegocio: 'Energía',
  contactoNombre: 'Rosa Contreras',
  contactoTelefono: '959 214 380',
  contactoCorreo: 'rcontreras@kallpa.pe',
  direccionFiscal: 'Av. Víctor Andrés Belaúnde 147',
  contactoCargo: 'Jefa de Planta',
  camposExtra: { anticipacionAlertaDias: 45 },
};

const insumoApi = {
  id: INSUMO,
  nombreComercial: 'Brodifacoum 0.005%',
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: 'DIG-1',
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  fichaTecnicaKey: 'f',
  hojaMsdsKey: 'h',
  resolucionKey: null,
  proveedor: null,
  estado: 'ACTIVO',
};

const equipoApi = {
  id: EQUIPO,
  codigoInterno: 'EQ-022',
  nombre: 'Aspersora de mochila',
  tipo: 'ASPERSION',
  marcaModelo: null,
  estadoOperativo: 'OPERATIVO',
  fechaAdquisicion: null,
  ultimoMantenimiento: null,
  proximoMantenimiento: null,
};

interface Sede {
  id: string;
  clienteId: string;
  estado: string;
  [campo: string]: unknown;
}

interface Estado {
  sedes: Sede[];
  servicios: Sede[];
  catalogosProhibidos: boolean;
}

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

let contador = 0;
const nuevoId = () => `aaaaaaaa-0000-4000-8000-${String(++contador).padStart(12, '0')}`;

/** API simulada en memoria: cliente, sedes, servicios y catálogos de insumos y equipos. */
function simularApi(estado: Estado) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const { pathname } = new URL(url);
    const ruta = pathname.replace('/api/mantenimiento', '');
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(init.body as string) : undefined;

    if (ruta === '/clientes') return json(200, { total: 1, limit: 100, offset: 0, items: [cliente] });
    if (ruta === `/clientes/${CLIENTE}`) return json(200, cliente);

    if (ruta === '/insumos' || ruta === '/equipos') {
      if (estado.catalogosProhibidos) return json(403, { statusCode: 403, message: 'Forbidden resource' });
      const items = ruta === '/insumos' ? [insumoApi] : [equipoApi];
      return json(200, { total: 1, limit: 100, offset: 0, items });
    }

    if (ruta === `/proyectos/cliente/${CLIENTE}`) return json(200, estado.sedes);
    if (ruta === '/proyectos' && metodo === 'POST') {
      if (estado.sedes.some((s) => s.nombre === cuerpo.nombre)) {
        return json(409, { statusCode: 409, message: `Ya existe una sede registrada con el nombre: ${cuerpo.nombre}` });
      }
      const sede = { id: nuevoId(), estado: 'ACTIVO', ...cuerpo } as Sede;
      estado.sedes.push(sede);
      return json(201, sede);
    }
    const sedeRuta = ruta.match(/^\/proyectos\/([^/]+)(?:\/(activar|desactivar))?$/);
    if (sedeRuta) {
      const sede = estado.sedes.find((s) => s.id === sedeRuta[1]);
      if (!sede) return json(404, { statusCode: 404, message: 'Sede no encontrada' });
      if (sedeRuta[2]) {
        sede.estado = sedeRuta[2] === 'activar' ? 'ACTIVO' : 'INACTIVO';
        return json(200, { id: sede.id, estado: sede.estado });
      }
      Object.assign(sede, cuerpo);
      return json(200, sede);
    }

    const porSede = ruta.match(/^\/servicios-contratados\/proyecto\/([^/]+)$/);
    if (porSede) return json(200, estado.servicios.filter((s) => s.proyectoId === porSede[1]));
    if (ruta === '/servicios-contratados' && metodo === 'POST') {
      if (cuerpo.frecuencia === 'DIARIA') {
        return json(400, {
          statusCode: 400,
          message: 'Validación',
          errors: [{ path: 'frecuencia', message: 'Esa frecuencia no está permitida para el tipo de servicio' }],
        });
      }
      const servicio = { id: nuevoId(), estado: 'ACTIVO', ...cuerpo } as Sede;
      estado.servicios.push(servicio);
      return json(201, servicio);
    }
    const servicioRuta = ruta.match(/^\/servicios-contratados\/([^/]+)(?:\/(activar|desactivar))?$/);
    if (servicioRuta) {
      const servicio = estado.servicios.find((s) => s.id === servicioRuta[1]);
      if (!servicio) return json(404, { statusCode: 404, message: 'Servicio no encontrado' });
      if (servicioRuta[2]) {
        servicio.estado = servicioRuta[2] === 'activar' ? 'ACTIVO' : 'INACTIVO';
        return json(200, { id: servicio.id, estado: servicio.estado });
      }
      Object.assign(servicio, cuerpo);
      return json(200, servicio);
    }
    return json(404, { statusCode: 404, message: `Sin simular: ${metodo} ${ruta}` });
  });
}

const sedeEjemplo = (): Sede => ({
  id: '7b1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a33',
  clienteId: CLIENTE,
  nombre: 'PLANTA_NORTE',
  direccionSede: 'Parque Industrial Mz. B',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  observaciones: null,
  estado: 'ACTIVO',
});

const servicioEjemplo = (sede: Sede): Sede => ({
  id: '9d1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a44',
  clienteId: CLIENTE,
  proyectoId: sede.id,
  tipoServicio: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotalM2: 1200,
  areaTratarM2: 800,
  insumosAutorizados: [INSUMO],
  equiposAutorizados: [EQUIPO],
  dosisReferencial: { [INSUMO]: '1 bloque por estación' },
  requiereCertificado: true,
  vigenciaDias: 180,
  estado: 'ACTIVO',
});

function estadoVacio(): Estado {
  return { sedes: [], servicios: [], catalogosProhibidos: false };
}

function estadoConSede(): Estado {
  const sede = sedeEjemplo();
  return { sedes: [sede], servicios: [servicioEjemplo(sede)], catalogosProhibidos: false };
}

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

async function abrirExpediente() {
  fireEvent.click(await screen.findByRole('button', { name: /Kallpa Energía S\.A\./ }));
  await screen.findByRole('heading', { name: 'Ficha del cliente' });
}

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function llamadas(metodo: string, sufijo = '') {
  return fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === metodo && String(url).endsWith(sufijo) );
}

function cuerpoDe(llamada: unknown[]) {
  return JSON.parse((llamada[1] as RequestInit).body as string);
}

describe('expediente: sedes y servicios conectados al API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    contador = 0;
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('lectura', () => {
    it('un cliente nuevo muestra el estado vacío con la salida de registrar la primera sede', async () => {
      simularApi(estadoVacio());
      montar();
      await abrirExpediente();

      expect(await screen.findByText(/Este cliente todavía no tiene sedes/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nueva sede' })).toBeInTheDocument();
    });

    it('lista las sedes con sus servicios usando las etiquetas de pantalla', async () => {
      simularApi(estadoConSede());
      montar();
      await abrirExpediente();

      const sede = (await screen.findByText('PLANTA_NORTE')).closest('li') as HTMLElement;
      expect(within(sede).getByText(/Parque Industrial Mz\. B, Cerro Colorado/)).toBeInTheDocument();
      expect(within(sede).getByText(/DRT — Desratización/)).toBeInTheDocument();
      expect(within(sede).getByText(/Quincenal/)).toBeInTheDocument();
      expect(within(sede).getByText(/certificado de 180 días/)).toBeInTheDocument();
    });

    it('muestra cargando y, si falla, el error con reintento', async () => {
      const estado = estadoConSede();
      simularApi(estado);
      const base = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
        String(url).includes('/proyectos/cliente/') ? json(500, { statusCode: 500, message: 'x' }) : base(url, init),
      );
      montar();
      await abrirExpediente();

      expect(await screen.findByText(/El servidor no pudo completar la operación/)).toBeInTheDocument();
      fetchMock.mockImplementation(base);
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('PLANTA_NORTE')).toBeInTheDocument();
    });

    it('las sedes siguen ahí al volver a abrir la aplicación', async () => {
      const estado = estadoConSede();
      simularApi(estado);
      const primera = montar();
      await abrirExpediente();
      expect(await screen.findByText('PLANTA_NORTE')).toBeInTheDocument();
      primera.unmount();

      montar();
      await abrirExpediente();
      expect(await screen.findByText('PLANTA_NORTE')).toBeInTheDocument();
    });
  });

  describe('sedes', () => {
    it('da de alta una sede: envía el cuerpo del contrato y la muestra en el expediente', async () => {
      const estado = estadoVacio();
      simularApi(estado);
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: 'Nueva sede' }));

      escribir('Nombre del proyecto', 'planta norte');
      escribir('Dirección de la sede', 'Parque Industrial Mz. B');
      escribir('Distrito', 'Cerro Colorado');
      escribir('Nombre', 'Luis Rojas');
      escribir('Cargo', 'Jefe de Planta');
      escribir('Teléfono', '054 223344');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar sede' }));

      expect(await screen.findByText(/Sede PLANTA_NORTE registrada/)).toBeInTheDocument();
      expect(cuerpoDe(llamadas('POST', '/proyectos')[0])).toEqual({
        clienteId: CLIENTE,
        nombre: 'PLANTA_NORTE',
        direccionSede: 'Parque Industrial Mz. B',
        distrito: 'Cerro Colorado',
        provincia: 'Arequipa',
        departamento: 'Arequipa',
        contactoNombre: 'Luis Rojas',
        contactoCargo: 'Jefe de Planta',
        contactoTelefono: '054 223344',
        observaciones: null,
      });
      expect(await screen.findByText('PLANTA_NORTE')).toBeInTheDocument();
    });

    it('un nombre repetido (409) se marca en el campo y el formulario queda abierto', async () => {
      simularApi(estadoConSede());
      montar();
      await abrirExpediente();
      // El nombre llega al servidor aunque la lista local aún no lo conozca.
      const base = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
      fireEvent.click(await screen.findByRole('button', { name: 'Nueva sede' }));
      escribir('Nombre del proyecto', 'OTRA_SEDE');
      escribir('Dirección de la sede', 'Av. 1');
      escribir('Distrito', 'Yanahuara');
      escribir('Nombre', 'A');
      escribir('Cargo', 'B');
      escribir('Teléfono', '054 223344');
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'POST' && String(url).endsWith('/proyectos')
          ? json(409, { statusCode: 409, message: 'Ya existe una sede registrada con el nombre: OTRA_SEDE' })
          : base(url, init),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Registrar sede' }));

      expect(await screen.findByText('Este cliente ya tiene una sede con ese nombre.')).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre del proyecto')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('button', { name: 'Registrar sede' })).toBeEnabled();
    });

    it('mientras guarda deshabilita el botón', async () => {
      simularApi(estadoVacio());
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: 'Nueva sede' }));
      escribir('Nombre del proyecto', 'PLANTA_SUR');
      escribir('Dirección de la sede', 'Av. 1');
      escribir('Distrito', 'Yanahuara');
      escribir('Nombre', 'A');
      escribir('Cargo', 'B');
      escribir('Teléfono', '054 223344');
      const base = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
      let liberar: () => void = () => {};
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'POST') await new Promise<void>((r) => (liberar = r));
        return base(url, init);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Registrar sede' }));

      expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();
      liberar();
      expect(await screen.findByText(/Sede PLANTA_SUR registrada/)).toBeInTheDocument();
    });

    it('edita una sede sin tocar el cliente', async () => {
      const estado = estadoConSede();
      simularApi(estado);
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: 'Editar sede PLANTA_NORTE' }));

      expect(screen.getByLabelText('Nombre del proyecto')).toHaveValue('PLANTA_NORTE');
      escribir('Distrito', 'Yanahuara');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar sede' }));

      expect(await screen.findByText(/Sede PLANTA_NORTE actualizada/)).toBeInTheDocument();
      const cuerpo = cuerpoDe(llamadas('PATCH', estado.sedes[0].id)[0]);
      expect(cuerpo).not.toHaveProperty('clienteId');
      expect(cuerpo).toMatchObject({ distrito: 'Yanahuara' });
      expect(estado.sedes[0].distrito).toBe('Yanahuara');
    });

    it('desactiva una sede (pasa a inactivos) y la vuelve a activar', async () => {
      simularApi(estadoConSede());
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: 'Desactivar sede PLANTA_NORTE' }));

      expect(await screen.findByText('Proyectos inactivos (1)')).toBeInTheDocument();
      expect(screen.getByText('Proyectos activos (0)')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Proyectos inactivos (1)'));
      fireEvent.click(await screen.findByRole('button', { name: 'Activar sede PLANTA_NORTE' }));

      expect(await screen.findByText('Proyectos activos (1)')).toBeInTheDocument();
      expect(llamadas('PATCH').map(([url]) => String(url).split('/').pop())).toEqual(['desactivar', 'activar']);
    });
  });

  describe('servicios', () => {
    it('da de alta un servicio con insumos y equipos del catálogo y lo muestra en la sede', async () => {
      const estado = estadoConSede();
      estado.servicios = [];
      simularApi(estado);
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: '+ Servicio en PLANTA_NORTE' }));

      escribir('Tipo de servicio', 'DSF');
      escribir('Frecuencia', 'MENSUAL');
      escribir('Área total del local', '1200');
      escribir('Área a tratar por visita', '800');
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Brodifacoum 0.005%' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Aspersora de mochila' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
      escribir('Vigencia del certificado', '90');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

      expect(await screen.findByText(/Servicio DSF \(mensual\) registrado en PLANTA_NORTE/)).toBeInTheDocument();
      expect(cuerpoDe(llamadas('POST', '/servicios-contratados')[0])).toEqual({
        proyectoId: estado.sedes[0].id,
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        areaTotalM2: 1200,
        areaTratarM2: 800,
        insumosAutorizados: [INSUMO],
        equiposAutorizados: [EQUIPO],
        dosisReferencial: { [INSUMO]: '1 bloque por estación' },
        requiereCertificado: true,
        vigenciaDias: 90,
      });
      expect(await screen.findByText(/DSF — Desinfección/)).toBeInTheDocument();
    });

    it('un error de validación del servidor se muestra en su campo y el formulario queda abierto', async () => {
      const estado = estadoConSede();
      estado.servicios = [];
      simularApi(estado);
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: '+ Servicio en PLANTA_NORTE' }));
      escribir('Tipo de servicio', 'DSF');
      escribir('Frecuencia', 'DIARIA');
      escribir('Área total del local', '1200');
      escribir('Área a tratar por visita', '800');
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Brodifacoum 0.005%' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Aspersora de mochila' }));
      fireEvent.click(screen.getByRole('radio', { name: 'No' }));
      fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

      expect(await screen.findByText('Esa frecuencia no está permitida para el tipo de servicio')).toBeInTheDocument();
      expect(screen.getByLabelText('Frecuencia')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('button', { name: 'Registrar servicio' })).toBeEnabled();
    });

    it('la regla cruzada del área la valida la pantalla antes de enviar', async () => {
      const estado = estadoConSede();
      estado.servicios = [];
      simularApi(estado);
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: '+ Servicio en PLANTA_NORTE' }));
      escribir('Tipo de servicio', 'DSF');
      escribir('Frecuencia', 'MENSUAL');
      escribir('Área total del local', '1200');
      escribir('Área a tratar por visita', '1500');
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Brodifacoum 0.005%' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Aspersora de mochila' }));
      fireEvent.click(screen.getByRole('radio', { name: 'No' }));

      fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

      expect(await screen.findByText('No puede superar el área total del local')).toBeInTheDocument();
      expect(screen.getByLabelText('Área a tratar por visita')).toHaveAttribute('aria-invalid', 'true');
      expect(llamadas('POST', '/servicios-contratados')).toHaveLength(0);
    });

    it('edita un servicio y desactiva y activa un servicio', async () => {
      const estado = estadoConSede();
      simularApi(estado);
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: 'Editar servicio DRT en PLANTA_NORTE' }));

      expect(screen.getByLabelText('Tipo de servicio')).toBeDisabled();
      expect(await screen.findByRole('checkbox', { name: 'Brodifacoum 0.005%' })).toBeChecked();
      escribir('Frecuencia', 'MENSUAL');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar servicio' }));

      expect(await screen.findByText(/Servicio DRT actualizado/)).toBeInTheDocument();
      const cuerpo = cuerpoDe(llamadas('PATCH', estado.servicios[0].id as string)[0]);
      expect(cuerpo).toMatchObject({ frecuencia: 'MENSUAL', areaTotalM2: 1200, vigenciaDias: 180 });
      expect(cuerpo).not.toHaveProperty('tipoServicio');

      fireEvent.click(await screen.findByRole('button', { name: 'Desactivar servicio DRT en PLANTA_NORTE' }));
      const activar = await screen.findByRole('button', { name: 'Activar servicio DRT en PLANTA_NORTE' });
      expect(estado.servicios[0].estado).toBe('INACTIVO');
      fireEvent.click(activar);
      await screen.findByRole('button', { name: 'Desactivar servicio DRT en PLANTA_NORTE' });
      expect(estado.servicios[0].estado).toBe('ACTIVO');
    });

    it('si el catálogo de insumos y equipos responde 403 el formulario avisa y no se rompe', async () => {
      const estado = estadoConSede();
      estado.catalogosProhibidos = true;
      simularApi(estado);
      montar();
      await abrirExpediente();
      fireEvent.click(await screen.findByRole('button', { name: '+ Servicio en PLANTA_NORTE' }));

      expect(await screen.findByText(/No se pudo cargar el catálogo de insumos y equipos/)).toBeInTheDocument();
      expect(screen.getByLabelText('Tipo de servicio')).toBeEnabled();
    });
  });

  describe('Supervisor', () => {
    it('ve sedes y servicios sin botones de escritura y no pide insumos ni equipos', async () => {
      simularApi(estadoConSede());
      montar('SUPERVISOR');
      await abrirExpediente();

      expect(await screen.findByText('PLANTA_NORTE')).toBeInTheDocument();
      expect(screen.getByText(/DRT — Desratización/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Nueva sede' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Editar sede|Desactivar sede|\+ Servicio|Editar servicio|Desactivar servicio/ })).not.toBeInTheDocument();
      const rutas = fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
      expect(rutas.some((r) => r.endsWith('/insumos') || r.endsWith('/equipos'))).toBe(false);
    });

    it('un cliente sin sedes muestra el estado vacío sin invitar a crearlas', async () => {
      simularApi(estadoVacio());
      montar('SUPERVISOR');
      await abrirExpediente();

      expect(await screen.findByText('Este cliente todavía no tiene sedes activas.')).toBeInTheDocument();
    });
  });
});

describe('expediente: espera de la lectura', () => {
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

  it('avisa que está cargando las sedes', async () => {
    simularApi(estadoConSede());
    const base = fetchMock.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>;
    let liberar: () => void = () => {};
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/proyectos/cliente/')) await new Promise<void>((r) => (liberar = r));
      return base(url, init);
    });
    montar();
    await abrirExpediente();

    expect(await screen.findByText('Cargando las sedes…')).toBeInTheDocument();
    liberar();
    await waitFor(() => expect(screen.getByText('PLANTA_NORTE')).toBeInTheDocument());
  });
});
