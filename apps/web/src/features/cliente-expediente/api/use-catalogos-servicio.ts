import { useQuery } from '@tanstack/react-query';
import { listarEquipos, listarInsumos } from './catalogos-servicio-api';

export const catalogosServicioKeys = {
  insumos: ['catalogos-servicio', 'insumos'] as const,
  equipos: ['catalogos-servicio', 'equipos'] as const,
};

/**
 * Insumos del catálogo para elegirlos en un servicio. El API solo los entrega a Administrador y Técnico:
 * con `habilitado` en falso (Supervisor) no se consulta, y un 403 inesperado queda como error de la consulta.
 */
export function useInsumosCatalogo(habilitado: boolean) {
  return useQuery({ queryKey: catalogosServicioKeys.insumos, queryFn: listarInsumos, enabled: habilitado });
}

/** Equipos del catálogo para asignarlos a un servicio; mismas reglas de acceso que los insumos. */
export function useEquiposCatalogo(habilitado: boolean) {
  return useQuery({ queryKey: catalogosServicioKeys.equipos, queryFn: listarEquipos, enabled: habilitado });
}
