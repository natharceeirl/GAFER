import type { ConfiguracionSistema } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import { actualizacionDeConfiguracion, type DatosConfiguracion } from '../model/configuracion-mapper';

const RUTA = '/mantenimiento/configuracion';

export function obtenerConfiguracion(): Promise<ConfiguracionSistema> {
  return apiFetch<ConfiguracionSistema>(RUTA);
}

export function actualizarConfiguracion(datos: DatosConfiguracion): Promise<ConfiguracionSistema> {
  return apiFetch<ConfiguracionSistema>(RUTA, { metodo: 'PATCH', cuerpo: actualizacionDeConfiguracion(datos) });
}
