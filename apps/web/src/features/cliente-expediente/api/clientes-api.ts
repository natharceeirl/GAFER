import type { ClienteDetalle } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import type { ClienteFila } from '../model/clientes-mock';
import {
  actualizacionDeDatos,
  filaDeApi,
  listadoDeApi,
  registroDeDatos,
  type ClienteListado,
  type ClienteResumenApi,
} from '../model/cliente-mapper';
import type { DatosCliente } from '../model/validaciones';

const RUTA = '/mantenimiento/clientes';
/** Máximo que admite el API por página (PaginacionQuerySchema). */
const POR_PAGINA = 100;

interface PaginaClientes {
  total: number;
  items: ClienteResumenApi[];
}

/** Recorre todas las páginas: la cartera completa se filtra y ordena en la pantalla. */
export async function listarClientes(): Promise<ClienteListado[]> {
  const items: ClienteResumenApi[] = [];
  let total = 0;
  do {
    const pagina = await apiFetch<PaginaClientes>(RUTA, { consulta: { limit: POR_PAGINA, offset: items.length } });
    total = pagina.total;
    if (pagina.items.length === 0) break;
    items.push(...pagina.items);
  } while (items.length < total);
  return items.map(listadoDeApi);
}

export async function obtenerCliente(id: string): Promise<ClienteFila> {
  return filaDeApi(await apiFetch<ClienteDetalle>(`${RUTA}/${id}`));
}

export async function crearCliente(datos: DatosCliente, anticipacionAlertaDias: number): Promise<ClienteListado> {
  const creado = await apiFetch<ClienteResumenApi>(RUTA, { metodo: 'POST', cuerpo: registroDeDatos(datos, anticipacionAlertaDias) });
  return listadoDeApi(creado);
}

export async function actualizarCliente(id: string, datos: DatosCliente, anticipacionAlertaDias: number): Promise<ClienteFila> {
  const actualizado = await apiFetch<ClienteDetalle>(`${RUTA}/${id}`, {
    metodo: 'PATCH',
    cuerpo: actualizacionDeDatos(datos, anticipacionAlertaDias),
  });
  return filaDeApi(actualizado);
}

export async function cambiarEstadoCliente(id: string, accion: 'activar' | 'desactivar'): Promise<void> {
  await apiFetch(`${RUTA}/${id}/${accion}`, { metodo: 'PATCH' });
}
