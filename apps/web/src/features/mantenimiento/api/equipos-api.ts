import type { CambioEstadoEquipo, Equipo, EstadoOperativoEquipo } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import { recorrerPaginas } from '../../../shared/api/paginacion';
import { actualizacionDeEquipo, registroDeEquipo, type DatosEquipo } from '../model/equipo-mapper';

const RUTA = '/mantenimiento/equipos';

/** Todo el catálogo de equipos: la pantalla y el formulario de servicio eligen entre el conjunto completo. */
export function listarEquipos(): Promise<Equipo[]> {
  return recorrerPaginas<Equipo>(RUTA);
}

export function crearEquipo(datos: DatosEquipo): Promise<Equipo> {
  return apiFetch<Equipo>(RUTA, { metodo: 'POST', cuerpo: registroDeEquipo(datos) });
}

export function actualizarEquipo(id: string, datos: DatosEquipo): Promise<Equipo> {
  return apiFetch<Equipo>(`${RUTA}/${id}`, { metodo: 'PATCH', cuerpo: actualizacionDeEquipo(datos) });
}

export function cambiarEstadoEquipo(id: string, estadoOperativo: EstadoOperativoEquipo): Promise<Equipo> {
  const cuerpo: CambioEstadoEquipo = { estadoOperativo };
  return apiFetch<Equipo>(`${RUTA}/${id}/estado`, { metodo: 'PATCH', cuerpo });
}
