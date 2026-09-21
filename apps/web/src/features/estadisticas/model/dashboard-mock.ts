import type { ColorAura } from '@gafer/contracts';

export type SeveridadAlerta = 'rojo' | 'amarillo' | 'ink';

export interface AlertaFila {
  id: string;
  severidad: SeveridadAlerta;
  texto: string;
  detalle: string;
}

export interface ServicioDelDia {
  id: string;
  cliente: string;
  proyecto: string;
  tipo: string;
  tecnico: string;
  hora: string;
  completado: boolean;
}

export interface SemanaServicio {
  semana: string;
  programados: number;
  ejecutados: number;
}

export const ALERTAS_MOCK: AlertaFila[] = [
  {
    id: 'a1',
    severidad: 'rojo',
    texto: 'Estación 12 escaló a aura ROJO',
    detalle: 'KALLPA · CSF_SUNNY · 4ta visita consecutiva con consumo',
  },
  {
    id: 'a2',
    severidad: 'rojo',
    texto: 'Certificado vencido hace 3 días',
    detalle: 'PETROPERU · PLANTA_NORTE · Reporte de Inspección de Roedores',
  },
  {
    id: 'a3',
    severidad: 'amarillo',
    texto: 'Certificado vence en 12 días',
    detalle: 'SAMAY · ALMACEN_02 · Informe de Desinfección',
  },
  {
    id: 'a4',
    severidad: 'amarillo',
    texto: 'Documento pendiente de aprobación hace 52h',
    detalle: 'MINACORP · CAMPAMENTO · INFORME-MINACORP-031-2026',
  },
  {
    id: 'a5',
    severidad: 'ink',
    texto: 'Cliente sin servicio hace 94 días',
    detalle: 'AGROSUR · sede única · riesgo de pérdida',
  },
];

export const SERVICIOS_HOY_MOCK: ServicioDelDia[] = [
  { id: 's1', cliente: 'KALLPA', proyecto: 'CSF_SUNNY', tipo: 'DRT', tecnico: 'R. Amamani', hora: '08:00', completado: true },
  { id: 's2', cliente: 'SAMAY', proyecto: 'ALMACEN_02', tipo: 'DSF', tecnico: 'J. Ipusari', hora: '09:30', completado: true },
  { id: 's3', cliente: 'PETROPERU', proyecto: 'PLANTA_NORTE', tipo: 'LRA', tecnico: 'R. Amamani', hora: '11:00', completado: false },
  { id: 's4', cliente: 'MINACORP', proyecto: 'CAMPAMENTO', tipo: 'DSS', tecnico: 'M. Agarate', hora: '14:00', completado: false },
  { id: 's5', cliente: 'CONSTRUYE_SAC', proyecto: 'OBRA_LOTE_7', tipo: 'LTS', tecnico: 'J. Ipusari', hora: '16:00', completado: false },
];

export const SERVICIOS_POR_SEMANA_MOCK: SemanaServicio[] = [
  { semana: '11 ago', programados: 62, ejecutados: 58 },
  { semana: '18 ago', programados: 67, ejecutados: 64 },
  { semana: '25 ago', programados: 59, ejecutados: 55 },
  { semana: '01 set', programados: 71, ejecutados: 63 },
  { semana: '08 set', programados: 68, ejecutados: 66 },
  { semana: '15 set', programados: 64, ejecutados: 61 },
];

export const AURA_ROJO: ColorAura = 'ROJO';
