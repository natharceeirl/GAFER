import type { EstadoActivoInactivo } from '@gafer/contracts';

export interface Insumo {
  id: string;
  nombre: string;
  principioActivo: string;
  presentacion: string;
  concentracion: string;
  registroDigesa: string;
  dosisReferencial: string;
  estado: EstadoActivoInactivo;
}

export type EstadoOperativo = 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO';

export interface Equipo {
  id: string;
  nombre: string;
  codigoInterno: string;
  tipo: string;
  estadoOperativo: EstadoOperativo;
}

export type CargoPersonal = 'Administrador' | 'Supervisor' | 'Técnico Operador';

export interface PersonalOperativo {
  id: string;
  nombre: string;
  dni: string;
  cargo: CargoPersonal;
  estado: EstadoActivoInactivo;
}

export interface CatalogoTexto {
  id: 'hallazgos' | 'acciones-correctivas' | 'observaciones' | 'recomendaciones' | 'giros' | 'motivos-modificacion';
  titulo: string;
  items: string[];
  /** Spec §7.7: "Motivos de modificación" lo edita solo el Administrador. */
  soloAdministrador?: boolean;
}
