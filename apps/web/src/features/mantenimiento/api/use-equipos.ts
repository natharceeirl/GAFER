import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EstadoOperativoEquipo } from '@gafer/contracts';
import type { DatosEquipo } from '../model/equipo-mapper';
import { actualizarEquipo, cambiarEstadoEquipo, crearEquipo, listarEquipos } from './equipos-api';

export const equiposKeys = {
  todos: ['mantenimiento', 'equipos'] as const,
};

/** Catálogo de equipos; mismas reglas de acceso que los insumos (Administrador y Técnico). */
export function useEquipos(habilitado = true) {
  return useQuery({ queryKey: equiposKeys.todos, queryFn: listarEquipos, enabled: habilitado });
}

function useInvalidarEquipos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: equiposKeys.todos, refetchType: 'all' });
}

export function useCrearEquipo() {
  const invalidar = useInvalidarEquipos();
  return useMutation({ mutationFn: (datos: DatosEquipo) => crearEquipo(datos), onSuccess: invalidar });
}

export function useActualizarEquipo() {
  const invalidar = useInvalidarEquipos();
  return useMutation({ mutationFn: ({ id, datos }: { id: string; datos: DatosEquipo }) => actualizarEquipo(id, datos), onSuccess: invalidar });
}

export function useCambiarEstadoEquipo() {
  const invalidar = useInvalidarEquipos();
  return useMutation({
    mutationFn: ({ id, estadoOperativo }: { id: string; estadoOperativo: EstadoOperativoEquipo }) => cambiarEstadoEquipo(id, estadoOperativo),
    onSuccess: invalidar,
  });
}
