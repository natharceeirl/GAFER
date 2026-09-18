import { useQuery } from '@tanstack/react-query';

interface InspeccionRemota {
  id: string;
  estado: 'BORRADOR' | 'CERRADO';
}

async function fetchInspeccion(servicioId: string): Promise<InspeccionRemota | null> {
  const response = await fetch(`/api/operaciones/inspecciones?servicioId=${servicioId}`);
  if (!response.ok) return null;
  return response.json();
}

/**
 * Cache de SERVIDOR (TanStack Query) — datos ya confirmados por el
 * backend. Ver la nota en use-borrador-store.ts sobre por qué nunca se
 * mezcla con el estado local.
 */
export function useInspeccionQuery(servicioId: string) {
  return useQuery({
    queryKey: ['inspeccion', servicioId],
    queryFn: () => fetchInspeccion(servicioId),
    enabled: Boolean(servicioId),
  });
}
