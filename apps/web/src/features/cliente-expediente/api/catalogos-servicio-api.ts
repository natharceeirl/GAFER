import type { Equipo as EquipoApi, Insumo as InsumoApi } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import { equipoDeApi, insumoDeApi } from '../model/catalogos-api-mapper';
import type { Equipo, Insumo } from '../../mantenimiento/model/tipos';

/** Máximo que admite el API por página (PaginacionQuerySchema). */
const POR_PAGINA = 100;

interface Pagina<T> {
  total: number;
  items: T[];
}

/** Recorre todas las páginas de un listado: el formulario elige entre el catálogo completo. */
async function recorrer<T>(ruta: string): Promise<T[]> {
  const items: T[] = [];
  let total = 0;
  do {
    const pagina = await apiFetch<Pagina<T>>(ruta, { consulta: { limit: POR_PAGINA, offset: items.length } });
    total = pagina.total;
    if (pagina.items.length === 0) break;
    items.push(...pagina.items);
  } while (items.length < total);
  return items;
}

export async function listarInsumos(): Promise<Insumo[]> {
  return (await recorrer<InsumoApi>('/mantenimiento/insumos')).map(insumoDeApi);
}

export async function listarEquipos(): Promise<Equipo[]> {
  return (await recorrer<EquipoApi>('/mantenimiento/equipos')).map(equipoDeApi);
}
