import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DatosCliente } from '../model/validaciones';
import { actualizarCliente, cambiarEstadoCliente, crearCliente, listarClientes, obtenerCliente } from './clientes-api';

export const clientesKeys = {
  todos: ['clientes'] as const,
  lista: ['clientes', 'lista'] as const,
  detalle: (id: string) => ['clientes', 'detalle', id] as const,
};

/** Cartera completa de clientes del API. */
export function useClientes() {
  return useQuery({ queryKey: clientesKeys.lista, queryFn: listarClientes });
}

/** Ficha de un cliente; sin identificador no consulta. */
export function useCliente(id: string | null) {
  return useQuery({
    queryKey: clientesKeys.detalle(id ?? ''),
    queryFn: () => obtenerCliente(id as string),
    enabled: id !== null,
  });
}

export function useCrearCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ datos, anticipacionAlertaDias }: { datos: DatosCliente; anticipacionAlertaDias: number }) =>
      crearCliente(datos, anticipacionAlertaDias),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientesKeys.lista }),
  });
}

export function useActualizarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos, anticipacionAlertaDias }: { id: string; datos: DatosCliente; anticipacionAlertaDias: number }) =>
      actualizarCliente(id, datos, anticipacionAlertaDias),
    onSuccess: (cliente) => {
      queryClient.setQueryData(clientesKeys.detalle(cliente.id), cliente);
      return queryClient.invalidateQueries({ queryKey: clientesKeys.lista });
    },
  });
}

function useCambiarEstado(accion: 'activar' | 'desactivar') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cambiarEstadoCliente(id, accion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientesKeys.todos }),
  });
}

export const useActivarCliente = () => useCambiarEstado('activar');
export const useDesactivarCliente = () => useCambiarEstado('desactivar');
