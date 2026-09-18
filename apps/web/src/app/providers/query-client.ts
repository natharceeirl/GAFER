import { QueryClient } from '@tanstack/react-query';

/**
 * Cache de SERVIDOR (TanStack Query). Separado a propósito del store
 * local de borradores offline — ver features/operaciones/model.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});
