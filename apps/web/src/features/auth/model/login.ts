import { LoginResponseSchema, type UsuarioSesion } from '@gafer/contracts';
import { apiFetch } from '../../../shared/api/http-client';
import { ErrorApi } from '../../../shared/api/errores';
import { esUsuarioWeb, useSesion } from '../../../shared/api/sesion';

export const MENSAJE_SIN_ACCESO_WEB =
  'El Técnico Operador trabaja solo desde la aplicación Android y no tiene acceso a la web. Ingrese desde la app o use una cuenta de Administrador o Supervisor.';

/** Valida usuario y clave en el API como cliente web; el rol sale de la respuesta y solo se guarda la sesión si la web lo admite. */
export async function ingresar(usuario: string, clave: string): Promise<UsuarioSesion> {
  let crudo: unknown;
  try {
    crudo = await apiFetch('/auth/login', { metodo: 'POST', cuerpo: { usuario, clave, cliente: 'web' } });
  } catch (error) {
    if (error instanceof ErrorApi && error.tipo === 'prohibido' && /TECNICO_OPERADOR/.test(error.message)) {
      throw new ErrorApi({ tipo: 'prohibido', status: error.status, mensaje: MENSAJE_SIN_ACCESO_WEB });
    }
    throw error;
  }

  const respuesta = LoginResponseSchema.safeParse(crudo);
  if (!respuesta.success) {
    throw new ErrorApi({ tipo: 'servidor', mensaje: 'La respuesta del servidor no es válida. Intente de nuevo.' });
  }
  if (!esUsuarioWeb(respuesta.data.usuario)) {
    throw new ErrorApi({ tipo: 'prohibido', mensaje: MENSAJE_SIN_ACCESO_WEB });
  }

  useSesion.getState().iniciar(respuesta.data.token, respuesta.data.usuario);
  return respuesta.data.usuario;
}
