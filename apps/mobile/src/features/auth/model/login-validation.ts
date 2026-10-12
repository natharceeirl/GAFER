export interface ValidacionLoginResultado {
  esValido: boolean;
  errorUsuario: string | null;
  errorClave: string | null;
}

/**
 * Valida los campos del formulario de ingreso de usuario antes de contactar a la API.
 */
export function validarFormularioLogin(
  usuario: string,
  clave: string,
): ValidacionLoginResultado {
  const usuarioLimpio = usuario.trim();
  let errorUsuario: string | null = null;
  let errorClave: string | null = null;

  if (!usuarioLimpio) {
    errorUsuario = 'El nombre de usuario es obligatorio';
  }

  if (!clave) {
    errorClave = 'La contraseña es obligatoria';
  }

  return {
    esValido: errorUsuario === null && errorClave === null,
    errorUsuario,
    errorClave,
  };
}
