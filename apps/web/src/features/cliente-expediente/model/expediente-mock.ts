import type { TipoServicio } from '@gafer/contracts';

/** Servicio contratado en una sede (§7.3): lo que después se precarga en el formulario de campo (§8.2). */
export interface ServicioContratado {
  id: string;
  tipoId: TipoServicio;
  /** Etiqueta para mostrar, ej. "DRT — Desratización". */
  tipo: string;
  frecuencia: string;
  requiereCertificado: boolean;
  insumos: string[];
  dosis: Record<string, string>;
  equipos: string[];
}

export interface ProyectoExpediente {
  id: string;
  nombre: string;
  direccion: string;
  distrito?: string;
  estado: 'ACTIVO' | 'INACTIVO';
  servicios: ServicioContratado[];
}

export const PROYECTOS_MOCK: ProyectoExpediente[] = [
  {
    id: 'p1',
    nombre: 'CSF_SUNNY',
    direccion: 'Parque Industrial Río Seco Mz. C Lote 4, Cerro Colorado',
    estado: 'ACTIVO',
    servicios: [
      {
        id: 's-p1-drt',
        tipoId: 'DRT',
        tipo: 'DRT — Desratización',
        frecuencia: 'Quincenal',
        requiereCertificado: true,
        insumos: ['i1', 'i3'],
        dosis: { i1: '1 bloque por estación', i3: '1 sobre por estación' },
        equipos: ['e2'],
      },
      {
        id: 's-p1-lra',
        tipoId: 'LRA',
        tipo: 'LRA — Limpieza de reservorios',
        frecuencia: 'Semestral',
        requiereCertificado: true,
        insumos: ['i5'],
        dosis: { i5: '50 ppm de cloro libre' },
        equipos: ['e2'],
      },
    ],
  },
  {
    id: 'p2',
    nombre: 'ALMACEN_02',
    direccion: 'Av. Aviación 4501, José Luis Bustamante y Rivero',
    estado: 'ACTIVO',
    servicios: [
      {
        id: 's-p2-dsf',
        tipoId: 'DSF',
        tipo: 'DSF — Desinfección',
        frecuencia: 'Mensual',
        requiereCertificado: true,
        insumos: ['i5'],
        dosis: { i5: '200 ppm en superficies' },
        equipos: ['e1'],
      },
    ],
  },
  {
    id: 'p3',
    nombre: 'OFICINA_CENTRAL',
    direccion: 'Calle Mercaderes 212, Arequipa',
    estado: 'INACTIVO',
    servicios: [
      {
        id: 's-p3-lam',
        tipoId: 'LAM',
        tipo: 'LAM — Limpieza de ambientes',
        frecuencia: 'Puntual',
        requiereCertificado: false,
        insumos: ['i5'],
        dosis: { i5: '100 ppm' },
        equipos: [],
      },
    ],
  },
];
