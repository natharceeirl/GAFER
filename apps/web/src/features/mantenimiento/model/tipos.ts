import type { EstadoActivoInactivo } from '@gafer/contracts';

export type CargoPersonal = 'Administrador' | 'Supervisor' | 'Técnico Operador';

export interface PersonalOperativo {
  id: string;
  nombre: string;
  dni: string;
  cargo: CargoPersonal;
  estado: EstadoActivoInactivo;
}

export type { CatalogoTexto } from '@gafer/contracts';
