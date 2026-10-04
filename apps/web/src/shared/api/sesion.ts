import { create } from 'zustand';
import { UsuarioSesionSchema, type UsuarioSesion } from '@gafer/contracts';

export const CLAVE_SESION = 'gafer.sesion';

export interface SesionGuardada {
  token: string;
  usuario: UsuarioSesion;
}

/** El Técnico Operador trabaja solo desde la app Android (decisión C10, §16): ninguna sesión suya vive en la web. */
export function esUsuarioWeb(usuario: UsuarioSesion): boolean {
  return usuario.cargo === 'ADMINISTRADOR' || usuario.cargo === 'SUPERVISOR';
}

/** Lee la sesión de esta pestaña; cualquier dato ausente, dañado o de un rol sin acceso web se descarta. */
export function cargarSesionGuardada(): SesionGuardada | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as { token?: unknown; usuario?: unknown };
    const usuario = UsuarioSesionSchema.safeParse(dato.usuario);
    if (typeof dato.token !== 'string' || dato.token === '' || !usuario.success || !esUsuarioWeb(usuario.data)) return null;
    return { token: dato.token, usuario: usuario.data };
  } catch {
    return null;
  }
}

function guardar(sesion: SesionGuardada | null) {
  try {
    if (sesion) sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    else sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    // Sin almacenamiento disponible la sesión vive solo en memoria.
  }
}

interface SesionEstado {
  token: string | null;
  usuario: UsuarioSesion | null;
  iniciar: (token: string, usuario: UsuarioSesion) => void;
  cerrar: () => void;
}

/** Token en memoria con respaldo en sessionStorage: cada pestaña tiene su propia sesión. */
export const useSesion = create<SesionEstado>((set) => ({
  ...(cargarSesionGuardada() ?? { token: null, usuario: null }),
  iniciar: (token, usuario) => {
    guardar({ token, usuario });
    set({ token, usuario });
  },
  cerrar: () => {
    guardar(null);
    set({ token: null, usuario: null });
  },
}));
