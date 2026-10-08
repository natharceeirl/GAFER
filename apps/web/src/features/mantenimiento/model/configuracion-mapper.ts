import type { ConfiguracionSistema, ConfiguracionSistemaActualizacion, DirectorTecnico } from '@gafer/contracts';
import { repartirError, type ErroresDeServidor } from '../../cliente-expediente/model/errores-servidor';

/**
 * Traducción entre `GET/PATCH /mantenimiento/configuracion` y el formulario del Director Técnico (decisión C7).
 * El formulario aplana el director (`director.cip` es `directorCip`). Los `parametros` globales no se editan desde
 * la pantalla: el API los acepta como un diccionario libre y no hay claves conocidas que mostrar.
 */

export interface DatosConfiguracion {
  directorNombre: string;
  directorCip: string;
  /** Imagen de la firma como data URL; nula si no hay firma. */
  directorFirma: string | null;
  resolucionSanitaria: string;
}

export function datosDeConfiguracion(c: ConfiguracionSistema): DatosConfiguracion {
  return {
    directorNombre: c.director?.nombre.trim() ?? '',
    directorCip: c.director?.cip ?? '',
    directorFirma: c.director?.firma ?? null,
    resolucionSanitaria: c.resolucionSanitaria,
  };
}

/** El Director Técnico con la forma que usan los documentos para estamparlo; nulo si la configuración no lo trae. */
export function directorDeConfiguracion(c: ConfiguracionSistema): DirectorTecnico | null {
  return c.director ? { nombre: c.director.nombre, cip: c.director.cip, firma: c.director.firma ?? null } : null;
}

/** Cuerpo de `PATCH /mantenimiento/configuracion`: el director viaja completo (nombre y CIP juntos). */
export function actualizacionDeConfiguracion(d: DatosConfiguracion): ConfiguracionSistemaActualizacion {
  return {
    director: { nombre: d.directorNombre.trim(), cip: d.directorCip.trim(), firma: d.directorFirma },
    resolucionSanitaria: d.resolucionSanitaria.trim(),
  };
}

export function campoDeRutaConfiguracion(ruta: string): keyof DatosConfiguracion | null {
  const campos: Record<string, keyof DatosConfiguracion> = {
    'director.nombre': 'directorNombre',
    'director.cip': 'directorCip',
    'director.firma': 'directorFirma',
    resolucionSanitaria: 'resolucionSanitaria',
  };
  return campos[ruta] ?? null;
}

/** Reparte un error del API entre los campos del formulario de configuración y un mensaje general. */
export function camposDeErrorConfiguracion(error: unknown): ErroresDeServidor<keyof DatosConfiguracion> {
  return repartirError(error, campoDeRutaConfiguracion);
}
