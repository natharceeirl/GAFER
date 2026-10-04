export type TipoErrorApi = 'validacion' | 'no-autenticado' | 'prohibido' | 'no-encontrado' | 'conflicto' | 'servidor' | 'red';

interface DatosErrorApi {
  tipo: TipoErrorApi;
  mensaje: string;
  status?: number | null;
  /** Mensaje por campo del cuerpo (ruta del API → texto), solo en errores 400 de validación. */
  campos?: Record<string, string>;
  mensajes?: string[];
}

/** Error del API ya traducido a un texto que la interfaz puede mostrar tal cual. */
export class ErrorApi extends Error {
  readonly tipo: TipoErrorApi;
  readonly status: number | null;
  readonly campos: Record<string, string>;
  readonly mensajes: string[];

  constructor({ tipo, mensaje, status = null, campos = {}, mensajes = [mensaje] }: DatosErrorApi) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.tipo = tipo;
    this.status = status;
    this.campos = campos;
    this.mensajes = mensajes;
  }
}

export const MENSAJE_RED = 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.';
const MENSAJE_SERVIDOR = 'El servidor no pudo completar la operación. Intente de nuevo en unos minutos.';
const MENSAJE_SESION = 'Su sesión expiró. Ingrese nuevamente.';
const MENSAJE_PERMISO = 'No tiene permiso para realizar esta acción.';
const MENSAJE_NO_ENCONTRADO = 'No se encontró el registro solicitado.';
const MENSAJE_CONFLICTO = 'La operación entra en conflicto con datos ya registrados.';
const MENSAJE_VALIDACION = 'Los datos enviados no son válidos.';

interface CuerpoError {
  message?: string | string[];
  errors?: Array<{ path?: string; message?: string }>;
}

function textoDe(cuerpo: CuerpoError | null): string | null {
  const mensaje = cuerpo?.message;
  if (typeof mensaje === 'string' && mensaje.trim() !== '') return mensaje;
  if (Array.isArray(mensaje) && mensaje.length > 0) return mensaje.join(' ');
  return null;
}

/** Traduce la respuesta de error del API (`{ message, errors: [{ path, message }] }` en los 400 de validación). */
export function errorDeRespuesta(status: number, cuerpo: CuerpoError | null, haySesion: boolean): ErrorApi {
  const texto = textoDe(cuerpo);

  if (status === 400) {
    const incidencias = (cuerpo?.errors ?? []).filter((e) => typeof e.message === 'string');
    const campos: Record<string, string> = {};
    for (const { path, message } of incidencias) {
      if (path && !(path in campos)) campos[path] = message as string;
    }
    const mensajes = incidencias.length > 0 ? incidencias.map((e) => e.message as string) : [texto ?? MENSAJE_VALIDACION];
    return new ErrorApi({
      tipo: 'validacion',
      status,
      campos,
      mensajes,
      mensaje: incidencias.length > 0 ? MENSAJE_VALIDACION : (texto ?? MENSAJE_VALIDACION),
    });
  }
  if (status === 401) {
    return new ErrorApi({ tipo: 'no-autenticado', status, mensaje: haySesion ? MENSAJE_SESION : (texto ?? MENSAJE_SESION) });
  }
  if (status === 403) return new ErrorApi({ tipo: 'prohibido', status, mensaje: texto ?? MENSAJE_PERMISO });
  if (status === 404) return new ErrorApi({ tipo: 'no-encontrado', status, mensaje: texto ?? MENSAJE_NO_ENCONTRADO });
  if (status === 409) return new ErrorApi({ tipo: 'conflicto', status, mensaje: texto ?? MENSAJE_CONFLICTO });
  return new ErrorApi({ tipo: 'servidor', status, mensaje: MENSAJE_SERVIDOR });
}

export function errorDeRed(): ErrorApi {
  return new ErrorApi({ tipo: 'red', mensaje: MENSAJE_RED });
}

/** Texto para mostrar al usuario de cualquier error capturado en una mutación o consulta. */
export function mensajeDeError(error: unknown): string {
  return error instanceof ErrorApi ? error.message : MENSAJE_SERVIDOR;
}
