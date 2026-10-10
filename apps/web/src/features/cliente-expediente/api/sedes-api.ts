import type { ProyectoDetalle, ServicioContratadoDetalle } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import { actualizacionDeProyecto, proyectoDeApi, registroDeProyecto, type ProyectoExpediente } from '../model/proyecto-mapper';
import { actualizacionDeServicio, registroDeServicio, servicioDeApi, type ServicioContratado } from '../model/servicio-mapper';
import type { DatosProyecto, DatosServicio } from '../model/validaciones';

const RUTA_SEDES = '/mantenimiento/proyectos';
const RUTA_SERVICIOS = '/mantenimiento/servicios-contratados';

type Accion = 'activar' | 'desactivar';

/**
 * Sedes de un cliente con los servicios de cada una. El API no ofrece una lectura conjunta: se pide la lista de
 * sedes y, por cada una, la de sus servicios (en paralelo). Si cualquiera falla, falla el expediente completo.
 */
export async function listarSedesConServicios(clienteId: string): Promise<ProyectoExpediente[]> {
  const sedes = await apiFetch<ProyectoDetalle[]>(`${RUTA_SEDES}/cliente/${clienteId}`);
  return Promise.all(
    sedes.map(async (sede) => {
      const servicios = await apiFetch<ServicioContratadoDetalle[]>(`${RUTA_SERVICIOS}/proyecto/${sede.id}`);
      return proyectoDeApi(sede, servicios.map(servicioDeApi));
    }),
  );
}

export async function crearSede(clienteId: string, datos: DatosProyecto): Promise<ProyectoExpediente> {
  const creada = await apiFetch<ProyectoDetalle>(RUTA_SEDES, { metodo: 'POST', cuerpo: registroDeProyecto(clienteId, datos) });
  return proyectoDeApi(creada, []);
}

/** La respuesta de la edición no trae los servicios: quien llama vuelve a leer las sedes. */
export async function actualizarSede(id: string, datos: DatosProyecto): Promise<ProyectoExpediente> {
  const actualizada = await apiFetch<ProyectoDetalle>(`${RUTA_SEDES}/${id}`, { metodo: 'PATCH', cuerpo: actualizacionDeProyecto(datos) });
  return proyectoDeApi(actualizada, []);
}

export async function cambiarEstadoSede(id: string, accion: Accion): Promise<void> {
  await apiFetch(`${RUTA_SEDES}/${id}/${accion}`, { metodo: 'PATCH' });
}

export async function crearServicio(proyectoId: string, datos: DatosServicio): Promise<ServicioContratado> {
  return servicioDeApi(await apiFetch<ServicioContratadoDetalle>(RUTA_SERVICIOS, { metodo: 'POST', cuerpo: registroDeServicio(proyectoId, datos) }));
}

export async function actualizarServicio(id: string, datos: DatosServicio): Promise<ServicioContratado> {
  return servicioDeApi(
    await apiFetch<ServicioContratadoDetalle>(`${RUTA_SERVICIOS}/${id}`, { metodo: 'PATCH', cuerpo: actualizacionDeServicio(datos) }),
  );
}

export async function cambiarEstadoServicio(id: string, accion: Accion): Promise<void> {
  await apiFetch(`${RUTA_SERVICIOS}/${id}/${accion}`, { metodo: 'PATCH' });
}
