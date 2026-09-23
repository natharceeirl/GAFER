import { QueryClient } from '@tanstack/react-query';

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
