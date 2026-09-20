import request = require('supertest');

/** Cliente HTTP mínimo contra la app de pruebas. */
export function api(baseUrl: string) {
  return {
    get: (url: string) => request(baseUrl).get(`/api${url}`),
    post: (url: string, body?: object) => request(baseUrl).post(`/api${url}`).send(body ?? {}),
    patch: (url: string, body?: object) => request(baseUrl).patch(`/api${url}`).send(body ?? {}),
  };
}
export type Api = ReturnType<typeof api>;

let contador = 0;

export interface Escenario {
  clienteId: string;
  proyectoId: string;
  servicioId: string;
  insumoId: string;
  equipoId: string;
  tecnicoId: string;
  /** Valores originales del insumo, tal como se registraron en el catálogo */
  insumoOriginal: { nombreComercial: string; principioActivo: string; registroDigesa: string; concentracion: string };
}

/**
 * Crea por la API (así también se ejercitan las validaciones reales) la cadena completa:
 * cliente -> proyecto -> servicio, más un insumo, un equipo y un técnico.
 * Cada llamada genera datos únicos, por lo que se puede invocar varias veces en un mismo test.
 */
export async function crearEscenario(http: Api): Promise<Escenario> {
  contador += 1;
  const n = String(contador).padStart(3, '0');

  const cliente = await http.post('/mantenimiento/clientes', {
    razonSocial: `Cliente Prueba ${n} S.A.`,
    ruc: `20${n.padStart(9, '0')}`,
    codigoCorto: `QA${n}`,
    direccionFiscal: 'Av. Las Palmas 123, Mollendo',
    giroNegocio: 'Generación Eléctrica',
    contactoNombre: 'Carlos Ramos',
    contactoCargo: 'Jefe de SSOMA',
    contactoTelefono: '958123456',
    contactoCorreo: 'cramos@example.com',
  });
  esperar(cliente.status, 201, 'crear cliente', cliente.body);

  const proyecto = await http.post('/mantenimiento/proyectos', {
    clienteId: cliente.body.id,
    nombre: `PLANTA_${n}`,
    direccionSede: 'Carretera Costanera Km 12',
    distrito: 'Mollendo',
    provincia: 'Islay',
    departamento: 'Arequipa',
    contactoNombre: 'Mario Vargas',
    contactoCargo: 'Supervisor de Planta',
    contactoTelefono: '954987654',
  });
  esperar(proyecto.status, 201, 'crear proyecto', proyecto.body);

  const servicio = await http.post('/mantenimiento/servicios-contratados', {
    proyectoId: proyecto.body.id,
    tipoServicio: 'DRT',
    frecuencia: 'MENSUAL',
    areaTotalM2: 5000,
    areaTratarM2: 3500,
    requiereCertificado: true,
    vigenciaDias: 30,
  });
  esperar(servicio.status, 201, 'crear servicio', servicio.body);

  const insumoOriginal = {
    nombreComercial: `Cipermetrina 25% (${n})`,
    principioActivo: 'Cipermetrina',
    registroDigesa: `RD-1425-2024/DIGESA/SA-${n}`,
    concentracion: '25% p/v',
  };
  const insumo = await http.post('/mantenimiento/insumos', {
    ...insumoOriginal,
    presentacion: 'LIQUIDO',
    unidadMedida: 'L',
    dosisEstandar: '5 ml/L',
    fichaTecnicaKey: 'insumos/fichas/cipermetrina-25.pdf',
    hojaMsdsKey: 'insumos/msds/cipermetrina-25.pdf',
  });
  esperar(insumo.status, 201, 'crear insumo', insumo.body);

  const equipo = await http.post('/mantenimiento/equipos', {
    codigoInterno: `EQ-NEB-${n}`,
    nombre: 'Nebulizadora ULV Vector Fog C-150',
    tipo: 'NEBULIZACION',
  });
  esperar(equipo.status, 201, 'crear equipo', equipo.body);

  const tecnico = await http.post('/mantenimiento/personal', {
    dni: `4589${n.padStart(4, '0')}`,
    nombres: 'Juan',
    apellidos: 'Perez Gomez',
    cargo: 'TECNICO_OPERADOR',
    telefono: '958123456',
    usuario: `JPEREZ${n}`,
  });
  esperar(tecnico.status, 201, 'crear personal', tecnico.body);

  return {
    clienteId: cliente.body.id,
    proyectoId: proyecto.body.id,
    servicioId: servicio.body.id,
    insumoId: insumo.body.id,
    equipoId: equipo.body.id,
    tecnicoId: tecnico.body.id,
    insumoOriginal,
  };
}

function esperar(actual: number, esperado: number, paso: string, body: unknown): void {
  if (actual !== esperado) {
    throw new Error(`[fixture] "${paso}" devolvió ${actual} (se esperaba ${esperado}): ${JSON.stringify(body)}`);
  }
}
