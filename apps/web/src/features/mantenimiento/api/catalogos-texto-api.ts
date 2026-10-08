import type { AgregarItemCatalogoTexto, CatalogoTexto, CatalogoTextoActualizacion } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';

const RUTA = '/mantenimiento/catalogos-texto';

/** Catálogos de texto que el rol puede ver: el API deja fuera los solo de Administrador para el Supervisor. */
export function listarCatalogosTexto(): Promise<CatalogoTexto[]> {
  return apiFetch<CatalogoTexto[]>(RUTA);
}

/** Agrega un texto al final del catálogo; el servidor ignora el que ya existe. */
export function agregarItemCatalogo(id: string, item: string): Promise<CatalogoTexto> {
  const cuerpo: AgregarItemCatalogoTexto = { item: item.trim() };
  return apiFetch<CatalogoTexto>(`${RUTA}/${id}/items`, { metodo: 'POST', cuerpo });
}

/** Reemplaza la lista completa y ordenada de textos del catálogo. */
export function actualizarItemsCatalogo(id: string, items: string[]): Promise<CatalogoTexto> {
  const cuerpo: CatalogoTextoActualizacion = { items };
  return apiFetch<CatalogoTexto>(`${RUTA}/${id}`, { metodo: 'PUT', cuerpo });
}
