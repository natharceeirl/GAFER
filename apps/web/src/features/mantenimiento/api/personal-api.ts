import type { Personal } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import { recorrerPaginas } from '../../../shared/api/paginacion';
import { actualizacionDePersonal, registroDePersonal, type DatosPersonal } from '../model/personal-mapper';
import type { AccionEstado } from './insumos-api';

const RUTA = '/mantenimiento/personal';

/** Todo el personal; el API lo entrega solo al Administrador. */
export function listarPersonal(): Promise<Personal[]> {
  return recorrerPaginas<Personal>(RUTA);
}

export function crearPersonal(datos: DatosPersonal): Promise<Personal> {
  return apiFetch<Personal>(RUTA, { metodo: 'POST', cuerpo: registroDePersonal(datos) });
}

export function actualizarPersonal(id: string, datos: DatosPersonal): Promise<Personal> {
  return apiFetch<Personal>(`${RUTA}/${id}`, { metodo: 'PATCH', cuerpo: actualizacionDePersonal(datos) });
}

export async function cambiarEstadoPersonal(id: string, accion: AccionEstado): Promise<void> {
  await apiFetch(`${RUTA}/${id}/${accion}`, { metodo: 'PATCH' });
}
