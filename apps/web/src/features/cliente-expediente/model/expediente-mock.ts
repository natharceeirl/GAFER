export interface ServicioContratado {
  tipo: string;
  frecuencia: string;
}

export interface ProyectoExpediente {
  id: string;
  nombre: string;
  direccion: string;
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
      { tipo: 'DRT — Desratización', frecuencia: 'Quincenal' },
      { tipo: 'LRA — Limpieza de reservorios', frecuencia: 'Semestral' },
    ],
  },
  {
    id: 'p2',
    nombre: 'ALMACEN_02',
    direccion: 'Av. Aviación 4501, José Luis Bustamante y Rivero',
    estado: 'ACTIVO',
    servicios: [{ tipo: 'DSF — Desinfección', frecuencia: 'Mensual' }],
  },
  {
    id: 'p3',
    nombre: 'OFICINA_CENTRAL',
    direccion: 'Calle Mercaderes 212, Arequipa',
    estado: 'INACTIVO',
    servicios: [{ tipo: 'LAM — Limpieza de ambientes', frecuencia: 'Puntual' }],
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
