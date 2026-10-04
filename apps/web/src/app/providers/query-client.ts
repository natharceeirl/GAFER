import { QueryClient } from '@tanstack/react-query';
import { useSesion } from '../../shared/api/sesion';

/**
 * Cache de SERVIDOR (TanStack Query). Los borradores offline de campo
 * viven en la app Android (apps/mobile/src/features/operaciones/model).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

/** Al cerrar la sesión (a mano o por un 401) no debe quedar nada del usuario anterior en la cache. */
useSesion.subscribe((estado, previo) => {
  if (previo.token && !estado.token) queryClient.clear();
});
