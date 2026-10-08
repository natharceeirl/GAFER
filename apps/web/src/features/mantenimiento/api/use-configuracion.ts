import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DatosConfiguracion } from '../model/configuracion-mapper';
import { actualizarConfiguracion, obtenerConfiguracion } from './configuracion-api';

export const configuracionKeys = {
  sistema: ['mantenimiento', 'configuracion'] as const,
};

/** Configuración del sistema (Director Técnico y resolución sanitaria); la leen Administrador y Supervisor. */
export function useConfiguracionSistema(habilitado = true) {
  return useQuery({ queryKey: configuracionKeys.sistema, queryFn: obtenerConfiguracion, enabled: habilitado });
}

/** Solo el Administrador guarda. La respuesta del servidor reemplaza la caché: los documentos ven al director nuevo. */
export function useActualizarConfiguracion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosConfiguracion) => actualizarConfiguracion(datos),
    onSuccess: (guardada) => queryClient.setQueryData(configuracionKeys.sistema, guardada),
  });
}
