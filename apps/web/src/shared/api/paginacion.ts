import { apiFetch } from './http-client';

/** Máximo que admite el API por página (PaginacionQuerySchema). */
const POR_PAGINA = 100;

interface Pagina<T> {
  total: number;
  items: T[];
}

/** Recorre todas las páginas de un listado del API (`{ total, items }`) y devuelve los registros juntos. */
export async function recorrerPaginas<T>(ruta: string): Promise<T[]> {
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
