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

export interface HistorialFila {
  fecha: string;
  proyecto: string;
  tipo: string;
  tecnico: string;
  documento: string;
}

export interface AlertaVencimiento {
  proyecto: string;
  documento: string;
  vence: string;
}

export interface PdfCarpeta {
  nombre: string;
  ruta: string;
  fecha: string;
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

export const HISTORIAL_MOCK: HistorialFila[] = [
  { fecha: '2026-09-10', proyecto: 'CSF_SUNNY', tipo: 'DRT', tecnico: 'R. Amamani', documento: 'REPORTE-KALLPA-014-2026' },
  { fecha: '2026-08-27', proyecto: 'CSF_SUNNY', tipo: 'DRT', tecnico: 'R. Amamani', documento: 'REPORTE-KALLPA-013-2026' },
  { fecha: '2026-08-14', proyecto: 'ALMACEN_02', tipo: 'DSF', tecnico: 'J. Ipusari', documento: 'INFORME-KALLPA-009-2026' },
  { fecha: '2026-07-30', proyecto: 'CSF_SUNNY', tipo: 'DRT', tecnico: 'M. Agarate', documento: 'REPORTE-KALLPA-012-2026' },
  { fecha: '2026-07-14', proyecto: 'ALMACEN_02', tipo: 'DSF', tecnico: 'J. Ipusari', documento: 'INFORME-KALLPA-008-2026' },
];

export const ALERTAS_VENCIMIENTO_MOCK: AlertaVencimiento[] = [
  { proyecto: 'CSF_SUNNY', documento: 'Certificado de saneamiento (Reporte de Roedores)', vence: '2026-10-14' },
];

export const PDFS_MOCK: PdfCarpeta[] = [
  { nombre: 'REPORTE-KALLPA-014-2026.pdf', ruta: 'KALLPA / CSF_SUNNY / DRT / 2026', fecha: '2026-09-10' },
  { nombre: 'REPORTE-KALLPA-013-2026.pdf', ruta: 'KALLPA / CSF_SUNNY / DRT / 2026', fecha: '2026-08-27' },
  { nombre: 'INFORME-KALLPA-009-2026.pdf', ruta: 'KALLPA / ALMACEN_02 / DSF / 2026', fecha: '2026-08-14' },
];
