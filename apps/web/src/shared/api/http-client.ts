import { errorDeRed, errorDeRespuesta } from './errores';
import { useSesion } from './sesion';

/** Origen del API (sin el prefijo /api). Coincide con el destino del proxy de desarrollo en vite.config.ts. */
const ORIGEN_API = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const URL_BASE = `${ORIGEN_API}/api`;

type Consulta = Record<string, string | number | boolean | undefined>;

export interface OpcionesApi {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  consulta?: Consulta;
}

function urlDe(ruta: string, consulta?: Consulta): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== '') parametros.set(clave, String(valor));
  }
  const texto = parametros.toString();
  return `${URL_BASE}${ruta}${texto ? `?${texto}` : ''}`;
}

async function leerJson(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();
  if (texto === '') return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

/**
 * Cliente fetch tipado del API. Adjunta el Bearer de la sesión y traduce los errores
 * a `ErrorApi`: un 401 con sesión activa la cierra, un 400 trae los mensajes por campo.
 */
export async function apiFetch<T = unknown>(ruta: string, { metodo = 'GET', cuerpo, consulta }: OpcionesApi = {}): Promise<T> {
  const { token, cerrar } = useSesion.getState();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(urlDe(ruta, consulta), {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw errorDeRed();
  }

  const datos = await leerJson(respuesta);
  if (respuesta.ok) return datos as T;

  if (respuesta.status === 401 && token) cerrar();
  throw errorDeRespuesta(respuesta.status, (datos ?? null) as Parameters<typeof errorDeRespuesta>[1], token !== null);
}
