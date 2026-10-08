import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DatosPersonal } from '../model/personal-mapper';
import { actualizarPersonal, cambiarEstadoPersonal, crearPersonal, listarPersonal } from './personal-api';

export const personalKeys = {
  todos: ['mantenimiento', 'personal'] as const,
};

/** Personal del sistema; solo el Administrador puede leerlo, por eso se puede deshabilitar la consulta. */
export function usePersonal(habilitado = true) {
  return useQuery({ queryKey: personalKeys.todos, queryFn: listarPersonal, enabled: habilitado });
}

/** Se vuelve a leer también si nadie la muestra (el formulario reemplaza la lista): al volver ya está al día. */
function useInvalidarPersonal() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: personalKeys.todos, refetchType: 'all' });
}

export function useCrearPersonal() {
  const invalidar = useInvalidarPersonal();
  return useMutation({ mutationFn: (datos: DatosPersonal) => crearPersonal(datos), onSuccess: invalidar });
}

export function useActualizarPersonal() {
  const invalidar = useInvalidarPersonal();
  return useMutation({ mutationFn: ({ id, datos }: { id: string; datos: DatosPersonal }) => actualizarPersonal(id, datos), onSuccess: invalidar });
}

function useCambiarEstadoPersonal(accion: 'activar' | 'desactivar') {
  const invalidar = useInvalidarPersonal();
  return useMutation({ mutationFn: (id: string) => cambiarEstadoPersonal(id, accion), onSuccess: invalidar });
}

export const useActivarPersonal = () => useCambiarEstadoPersonal('activar');
export const useDesactivarPersonal = () => useCambiarEstadoPersonal('desactivar');
