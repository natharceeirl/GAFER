import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DatosProyecto, DatosServicio } from '../model/validaciones';
import {
  actualizarSede,
  actualizarServicio,
  cambiarEstadoSede,
  cambiarEstadoServicio,
  crearSede,
  crearServicio,
  listarSedesConServicios,
} from './sedes-api';

export const sedesKeys = {
  todos: ['sedes'] as const,
  cliente: (clienteId: string) => ['sedes', 'cliente', clienteId] as const,
};

/** Sedes del cliente con sus servicios; sin identificador no consulta. */
export function useSedes(clienteId: string | null) {
  return useQuery({
    queryKey: sedesKeys.cliente(clienteId ?? ''),
    queryFn: () => listarSedesConServicios(clienteId as string),
    enabled: clienteId !== null,
  });
}

/** Cualquier cambio en una sede o en sus servicios deja obsoleta la lectura conjunta del expediente. */
function useInvalidarSedes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: sedesKeys.todos });
}

export function useCrearSede() {
  const invalidar = useInvalidarSedes();
  return useMutation({
    mutationFn: ({ clienteId, datos }: { clienteId: string; datos: DatosProyecto }) => crearSede(clienteId, datos),
    onSuccess: invalidar,
  });
}

export function useActualizarSede() {
  const invalidar = useInvalidarSedes();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: DatosProyecto }) => actualizarSede(id, datos),
    onSuccess: invalidar,
  });
}

function useCambiarEstadoSede(accion: 'activar' | 'desactivar') {
  const invalidar = useInvalidarSedes();
  return useMutation({ mutationFn: (id: string) => cambiarEstadoSede(id, accion), onSuccess: invalidar });
}

export const useActivarSede = () => useCambiarEstadoSede('activar');
export const useDesactivarSede = () => useCambiarEstadoSede('desactivar');

export function useCrearServicio() {
  const invalidar = useInvalidarSedes();
  return useMutation({
    mutationFn: ({ proyectoId, datos }: { proyectoId: string; datos: DatosServicio }) => crearServicio(proyectoId, datos),
    onSuccess: invalidar,
  });
}

export function useActualizarServicio() {
  const invalidar = useInvalidarSedes();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: DatosServicio }) => actualizarServicio(id, datos),
    onSuccess: invalidar,
  });
}

function useCambiarEstadoServicio(accion: 'activar' | 'desactivar') {
  const invalidar = useInvalidarSedes();
  return useMutation({ mutationFn: (id: string) => cambiarEstadoServicio(id, accion), onSuccess: invalidar });
}

export const useActivarServicio = () => useCambiarEstadoServicio('activar');
export const useDesactivarServicio = () => useCambiarEstadoServicio('desactivar');
