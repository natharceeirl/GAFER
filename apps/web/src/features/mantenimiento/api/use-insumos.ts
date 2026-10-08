import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DatosInsumo } from '../model/insumo-mapper';
import { actualizarInsumo, cambiarEstadoInsumo, crearInsumo, listarInsumos } from './insumos-api';

export const insumosKeys = {
  todos: ['mantenimiento', 'insumos'] as const,
};

/**
 * Catálogo de insumos. El API lo entrega solo a Administrador y Técnico: con `habilitado` en falso (Supervisor)
 * no se consulta, y un 403 inesperado queda como error de la consulta.
 */
export function useInsumos(habilitado = true) {
  return useQuery({ queryKey: insumosKeys.todos, queryFn: listarInsumos, enabled: habilitado });
}

/**
 * Cualquier cambio en un insumo deja obsoleto el catálogo, tanto en Mantenimiento como en el formulario de servicio.
 * Se vuelve a leer también si nadie lo está mostrando (el formulario reemplaza la lista): así al volver ya está al día.
 */
function useInvalidarInsumos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: insumosKeys.todos, refetchType: 'all' });
}

export function useCrearInsumo() {
  const invalidar = useInvalidarInsumos();
  return useMutation({ mutationFn: (datos: DatosInsumo) => crearInsumo(datos), onSuccess: invalidar });
}

export function useActualizarInsumo() {
  const invalidar = useInvalidarInsumos();
  return useMutation({ mutationFn: ({ id, datos }: { id: string; datos: DatosInsumo }) => actualizarInsumo(id, datos), onSuccess: invalidar });
}

function useCambiarEstadoInsumo(accion: 'activar' | 'desactivar') {
  const invalidar = useInvalidarInsumos();
  return useMutation({ mutationFn: (id: string) => cambiarEstadoInsumo(id, accion), onSuccess: invalidar });
}

export const useActivarInsumo = () => useCambiarEstadoInsumo('activar');
export const useDesactivarInsumo = () => useCambiarEstadoInsumo('desactivar');
