/**
 * Edición de la lista de un catálogo de texto (§7.7). El API guarda la lista completa y ordenada de textos
 * (`PUT catalogos-texto/:id`) o agrega uno al final (`POST catalogos-texto/:id/items`); estas funciones arman la
 * lista nueva sin tocar la original.
 */

const normalizar = (texto: string) => texto.trim().toLowerCase();

/** Motivo por el que un texto no se puede agregar al catálogo, o nulo si se puede. */
export function validarItem(texto: string, existentes: string[]): string | null {
  if (texto.trim() === '') return 'Escriba el texto que desea agregar.';
  if (existentes.some((e) => normalizar(e) === normalizar(texto))) return 'Ese texto ya está en el catálogo.';
  return null;
}

export function reemplazarItem(items: string[], posicion: number, texto: string): string[] {
  return items.map((item, i) => (i === posicion ? texto.trim() : item));
}

export function quitarItem(items: string[], posicion: number): string[] {
  return items.filter((_, i) => i !== posicion);
}
