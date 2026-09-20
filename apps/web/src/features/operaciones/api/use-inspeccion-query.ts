import { useQuery } from '@tanstack/react-query';

interface InspeccionRemota {
  id: string;
  estado: 'BORRADOR' | 'CERRADO';
}

async function fetchInspeccion(servicioId: string): Promise<InspeccionRemota | null> {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const response = await fetch(
    `${baseUrl}/api/operaciones/inspecciones?servicioId=${encodeURIComponent(servicioId)}`,
  );
  if (!response.ok) return null;
  const text = await response.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
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
