import type { Insumo } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import { recorrerPaginas } from '../../../shared/api/paginacion';
import { actualizacionDeInsumo, registroDeInsumo, type DatosInsumo } from '../model/insumo-mapper';

const RUTA = '/mantenimiento/insumos';

export type AccionEstado = 'activar' | 'desactivar';

/** Todo el catálogo de insumos: la pantalla y el formulario de servicio eligen entre el conjunto completo. */
export function listarInsumos(): Promise<Insumo[]> {
  return recorrerPaginas<Insumo>(RUTA);
}

export function crearInsumo(datos: DatosInsumo): Promise<Insumo> {
  return apiFetch<Insumo>(RUTA, { metodo: 'POST', cuerpo: registroDeInsumo(datos) });
}

export function actualizarInsumo(id: string, datos: DatosInsumo): Promise<Insumo> {
  return apiFetch<Insumo>(`${RUTA}/${id}`, { metodo: 'PATCH', cuerpo: actualizacionDeInsumo(datos) });
}

export async function cambiarEstadoInsumo(id: string, accion: AccionEstado): Promise<void> {
  await apiFetch(`${RUTA}/${id}/${accion}`, { metodo: 'PATCH' });
}
