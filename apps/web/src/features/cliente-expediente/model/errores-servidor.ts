import { ErrorApi, mensajeDeError } from '../../../shared/api/errores';
import type { Errores } from './validaciones';

export interface ErroresDeServidor<K extends string> {
  campos: Errores<K>;
  /** Mensaje para mostrar sobre el formulario cuando el error no es de un campo concreto. */
  general: string | null;
}

/**
 * Reparte un error del API entre los campos de un formulario y un mensaje general.
 * `campoDeRuta` traduce la ruta del cuerpo al campo; `conflicto` marca el campo de un 409 reconocible por su texto.
 */
export function repartirError<K extends string>(
  error: unknown,
  campoDeRuta: (ruta: string) => K | null,
  conflicto: (mensaje: string) => Errores<K> | null = () => null,
): ErroresDeServidor<K> {
  if (!(error instanceof ErrorApi)) return { campos: {}, general: mensajeDeError(error) };

  if (error.tipo === 'validacion') {
    const campos: Errores<K> = {};
    for (const [ruta, mensaje] of Object.entries(error.campos)) {
      const campo = campoDeRuta(ruta);
      if (campo) campos[campo] = mensaje;
    }
    return { campos, general: error.message };
  }

  if (error.tipo === 'conflicto') {
    const campos = conflicto(error.message);
    if (campos) return { campos, general: null };
  }

  return { campos: {}, general: error.message };
}
