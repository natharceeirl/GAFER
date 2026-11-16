import type { Mock } from 'vitest';

/**
 * API de Mantenimiento simulada en memoria para las pruebas del expediente (GAF-99): clientes, sedes, servicios
 * con su estado de trabajo, catálogos de insumos y equipos, y el catálogo de giros. Las reglas de transición
 * del estado de trabajo imitan las del servidor para que las pruebas recorran respuestas reales (200 y 400).
 */

export const CLIENTE_ID = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';
export const SEDE_ID = '7b1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a33';
export const SERVICIO_ID = '9d1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a44';
export const INSUMO_ID = '11111111-1111-4111-8111-111111111111';
export const EQUIPO_ID = '22222222-2222-4222-8222-222222222222';

type Fila = Record<string, unknown> & { id: string };

export interface EstadoSimulado {
  clientes: Fila[];
  sedes: Fila[];
  servicios: Fila[];
  /** Si tiene texto, el cambio de estado responde 400 con ese mensaje en el campo `motivo`. */
  errorMotivo: string | null;
}

const clienteKallpa = (): Fila => ({
  id: CLIENTE_ID,
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
});

export const sedeEjemplo = (): Fila => ({
  id: SEDE_ID,
  clienteId: CLIENTE_ID,
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

export const servicioEjemplo = (cambios: Partial<Fila> = {}): Fila => ({
  id: SERVICIO_ID,
  proyectoId: SEDE_ID,
  tipoServicio: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotalM2: 1200,
  areaTratarM2: 800,
  insumosAutorizados: [INSUMO_ID],
  equiposAutorizados: [EQUIPO_ID],
  dosisReferencial: { [INSUMO_ID]: '1 bloque por estación' },
  requiereCertificado: true,
  vigenciaDias: 180,
  estado: 'ACTIVO',
  estadoTrabajo: 'PENDIENTE',
  ...cambios,
});

/** Kallpa sin sedes: el punto de partida del alta rápida. */
export function estadoSoloCliente(): EstadoSimulado {
  return { clientes: [clienteKallpa()], sedes: [], servicios: [], errorMotivo: null };
}

/** Kallpa con una sede y los servicios indicados (por defecto, uno pendiente). */
export function estadoConServicios(servicios: Fila[] = [servicioEjemplo()]): EstadoSimulado {
  return { clientes: [clienteKallpa()], sedes: [sedeEjemplo()], servicios, errorMotivo: null };
}

const insumoApi = {
  id: INSUMO_ID,
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
  id: EQUIPO_ID,
  codigoInterno: 'EQ-022',
  nombre: 'Aspersora de mochila',
  tipo: 'ASPERSION',
  marcaModelo: null,
  estadoOperativo: 'OPERATIVO',
  fechaAdquisicion: null,
  ultimoMantenimiento: null,
  proximoMantenimiento: null,
};

const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE: ['EN_CURSO', 'CANCELADO'],
  EN_CURSO: ['COMPLETADO', 'CANCELADO'],
  COMPLETADO: ['EN_CURSO'],
  CANCELADO: ['EN_CURSO'],
};

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

const error400Motivo = (mensaje: string) =>
  json(400, { statusCode: 400, message: [`motivo: ${mensaje}`], errors: [{ path: 'motivo', message: mensaje }] });

let contador = 0;
const nuevoId = () => `aaaaaaaa-0000-4000-8000-${String(++contador).padStart(12, '0')}`;

/** Conecta el `fetch` simulado al estado en memoria; devuelve el mismo estado para revisarlo en la prueba. */
export function simularApiExpediente(fetchMock: Mock, estado: EstadoSimulado): EstadoSimulado {
  contador = 0;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const ruta = new URL(url).pathname.replace('/api/mantenimiento', '');
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(init.body as string) : undefined;

    if (ruta === '/catalogos-texto') {
      return json(200, [{ id: 'giros', titulo: 'Giros de negocio', items: ['Alimentos', 'Energía'], soloAdministrador: false }]);
    }
    if (ruta === '/insumos') return json(200, { total: 1, limit: 100, offset: 0, items: [insumoApi] });
    if (ruta === '/equipos') return json(200, { total: 1, limit: 100, offset: 0, items: [equipoApi] });

    if (ruta === '/clientes' && metodo === 'GET') {
      return json(200, { total: estado.clientes.length, limit: 100, offset: 0, items: estado.clientes });
    }
    if (ruta === '/clientes' && metodo === 'POST') {
      const nuevo = { id: nuevoId(), estado: 'ACTIVO', ...cuerpo } as Fila;
      estado.clientes.push(nuevo);
      return json(201, nuevo);
    }
    const cliente = ruta.match(/^\/clientes\/([^/]+)$/);
    if (cliente) {
      const encontrado = estado.clientes.find((c) => c.id === cliente[1]);
      return encontrado ? json(200, encontrado) : json(404, { statusCode: 404, message: 'Cliente no encontrado' });
    }

    const sedesDe = ruta.match(/^\/proyectos\/cliente\/([^/]+)$/);
    if (sedesDe) return json(200, estado.sedes.filter((s) => s.clienteId === sedesDe[1]));
    if (ruta === '/proyectos' && metodo === 'POST') {
      const sede = { id: nuevoId(), estado: 'ACTIVO', ...cuerpo } as Fila;
      estado.sedes.push(sede);
      return json(201, sede);
    }

    const porSede = ruta.match(/^\/servicios-contratados\/proyecto\/([^/]+)$/);
    if (porSede) return json(200, estado.servicios.filter((s) => s.proyectoId === porSede[1]));
    if (ruta === '/servicios-contratados' && metodo === 'POST') {
      const servicio = { id: nuevoId(), estado: 'ACTIVO', estadoTrabajo: 'PENDIENTE', ...cuerpo } as Fila;
      estado.servicios.push(servicio);
      return json(201, servicio);
    }
    const cambio = ruta.match(/^\/servicios-contratados\/([^/]+)\/estado$/);
    if (cambio && metodo === 'PATCH') {
      const servicio = estado.servicios.find((s) => s.id === cambio[1]);
      if (!servicio) return json(404, { statusCode: 404, message: 'Servicio no encontrado' });
      if (estado.errorMotivo) return error400Motivo(estado.errorMotivo);
      const anterior = servicio.estadoTrabajo as string;
      if (!TRANSICIONES[anterior].includes(cuerpo.estado)) {
        return json(400, { statusCode: 400, message: `No se puede pasar el servicio de ${anterior} a ${cuerpo.estado}` });
      }
      const pideMotivo = cuerpo.estado === 'CANCELADO' || anterior === 'COMPLETADO' || anterior === 'CANCELADO';
      if (pideMotivo && (cuerpo.motivo ?? '').trim().length < 5) return error400Motivo('El motivo es obligatorio');
      servicio.estadoTrabajo = cuerpo.estado;
      return json(200, servicio);
    }

    return json(404, { statusCode: 404, message: `Sin simular: ${metodo} ${ruta}` });
  });
  return estado;
}

/** Llamadas al `fetch` simulado con ese método cuya URL termina en el sufijo. */
export function llamadasA(fetchMock: Mock, metodo: string, sufijo = ''): unknown[][] {
  return fetchMock.mock.calls.filter(([url, init]) => ((init as RequestInit | undefined)?.method ?? 'GET') === metodo && String(url).endsWith(sufijo));
}

export function cuerpoDe(llamada: unknown[]): unknown {
  return JSON.parse((llamada[1] as RequestInit).body as string);
}
