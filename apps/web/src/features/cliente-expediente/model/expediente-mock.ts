import type { ProyectoExpediente } from './proyecto-mapper';
import type { ServicioContratado } from './servicio-mapper';

/** Sedes de muestra que comparten los clientes de ejemplo de la maqueta (programación, tablero y mapa murino). */
const CLIENTE_DE_EJEMPLO = 'cliente-de-ejemplo';

const servicio = (s: Partial<ServicioContratado> & Pick<ServicioContratado, 'id' | 'proyectoId' | 'tipoServicio' | 'frecuencia'>): ServicioContratado => ({
  areaTotalM2: 1200,
  areaTratarM2: 800,
  insumosAutorizados: [],
  equiposAutorizados: [],
  dosisReferencial: {},
  requiereCertificado: true,
  vigenciaDias: 180,
  estado: 'ACTIVO',
  ...s,
});

const sede = (p: Pick<ProyectoExpediente, 'id' | 'nombre' | 'direccion' | 'distrito' | 'estado' | 'servicios'>): ProyectoExpediente => ({
  clienteId: CLIENTE_DE_EJEMPLO,
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054 223344',
  observaciones: '',
  ...p,
});

export const PROYECTOS_MOCK: ProyectoExpediente[] = [
  sede({
    id: 'p1',
    nombre: 'CSF_SUNNY',
    direccion: 'Parque Industrial Río Seco Mz. C Lote 4, Cerro Colorado',
    distrito: 'Cerro Colorado',
    estado: 'ACTIVO',
    servicios: [
      servicio({
        id: 's-p1-drt',
        proyectoId: 'p1',
        tipoServicio: 'DRT',
        frecuencia: 'QUINCENAL',
        insumosAutorizados: ['i1', 'i3'],
        dosisReferencial: { i1: '1 bloque por estación', i3: '1 sobre por estación' },
        equiposAutorizados: ['e2'],
      }),
      servicio({
        id: 's-p1-lra',
        proyectoId: 'p1',
        tipoServicio: 'LRA',
        frecuencia: 'SEMESTRAL',
        insumosAutorizados: ['i5'],
        dosisReferencial: { i5: '50 ppm de cloro libre' },
        equiposAutorizados: ['e2'],
      }),
    ],
  }),
  sede({
    id: 'p2',
    nombre: 'ALMACEN_02',
    direccion: 'Av. Aviación 4501, José Luis Bustamante y Rivero',
    distrito: 'José Luis Bustamante y Rivero',
    estado: 'ACTIVO',
    servicios: [
      servicio({
        id: 's-p2-dsf',
        proyectoId: 'p2',
        tipoServicio: 'DSF',
        frecuencia: 'MENSUAL',
        insumosAutorizados: ['i5'],
        dosisReferencial: { i5: '200 ppm en superficies' },
        equiposAutorizados: ['e1'],
      }),
    ],
  }),
  sede({
    id: 'p3',
    nombre: 'OFICINA_CENTRAL',
    direccion: 'Calle Mercaderes 212, Arequipa',
    distrito: 'Arequipa',
    estado: 'INACTIVO',
    servicios: [
      servicio({
        id: 's-p3-lam',
        proyectoId: 'p3',
        tipoServicio: 'LAM',
        frecuencia: 'PUNTUAL',
        requiereCertificado: false,
        vigenciaDias: null,
        insumosAutorizados: ['i5'],
        dosisReferencial: { i5: '100 ppm' },
      }),
    ],
  }),
];
