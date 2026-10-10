import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CatalogoTexto } from '@gafer/contracts';
import { actualizarItemsCatalogo, agregarItemCatalogo, listarCatalogosTexto } from './catalogos-texto-api';

export const catalogosTextoKeys = {
  todos: ['mantenimiento', 'catalogos-texto'] as const,
};

/** Catálogos de texto; todos los roles los leen. */
export function useCatalogosTexto(habilitado = true) {
  return useQuery({ queryKey: catalogosTextoKeys.todos, queryFn: listarCatalogosTexto, enabled: habilitado });
}

/** Deja el catálogo que devolvió el servidor en la lista de inmediato y vuelve a leerla para confirmar. */
function useAplicarCatalogo() {
  const queryClient = useQueryClient();
  return (guardado: CatalogoTexto) => {
    queryClient.setQueryData<CatalogoTexto[]>(catalogosTextoKeys.todos, (lista) => lista?.map((c) => (c.id === guardado.id ? guardado : c)));
    return queryClient.invalidateQueries({ queryKey: catalogosTextoKeys.todos, refetchType: 'all' });
  };
}

export function useAgregarItemCatalogo() {
  const aplicar = useAplicarCatalogo();
  return useMutation({ mutationFn: ({ id, item }: { id: string; item: string }) => agregarItemCatalogo(id, item), onSuccess: aplicar });
}

export function useActualizarCatalogoTexto() {
  const aplicar = useAplicarCatalogo();
  return useMutation({ mutationFn: ({ id, items }: { id: string; items: string[] }) => actualizarItemsCatalogo(id, items), onSuccess: aplicar });
}
