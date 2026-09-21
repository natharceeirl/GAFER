import { useQuery } from '@tanstack/react-query';

interface InspeccionRemota {
  id: string;
  estado: 'BORRADOR' | 'CERRADO';
}

/**
 * Mockup sin backend conectado todavía (Fase 1 usa adapters en
 * memoria del lado del servidor, no expuestos aún a este front).
 * Simula la latencia y la forma de la respuesta real sin pegarle a
 * un endpoint que no existe — evita una carrera de fetch+retry real
 * contra un 404 en cada apertura de servicio.
 */
async function fetchInspeccion(servicioId: string): Promise<InspeccionRemota | null> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return { id: servicioId, estado: 'BORRADOR' };
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
