import { create } from 'zustand';
import { UsuarioSesion } from '@gafer/contracts';
import {
  MobileApiClient,
  CredencialesInvalidasError,
  UsuarioInactivoError,
  ErrorDeConexion,
} from '../../../shared/api/api-client';
import {
  getDefaultStorage,
  StorageAdapter,
} from '../../../shared/storage/storage-adapter';

export type EstadoAutenticacion = 'NO_AUTENTICADO' | 'AUTENTICADO' | 'CARGANDO';

export const TOKEN_STORAGE_KEY = 'gafer_mobile_token_v1';
export const USER_STORAGE_KEY = 'gafer_mobile_user_v1';

export interface AuthState {
  token: string | null;
  usuario: UsuarioSesion | null;
  estado: EstadoAutenticacion;
  error: string | null;

  iniciarSesion: (usuario: string, clave: string) => Promise<boolean>;
  cerrarSesion: () => Promise<void>;
  restaurarSesion: () => Promise<boolean>;
  limpiarError: () => void;
}

let customApiClient: MobileApiClient | null = null;
let customStorage: StorageAdapter | null = null;

export function configurarDependenciasAuth(
  apiClient?: MobileApiClient,
  storage?: StorageAdapter,
): void {
  customApiClient = apiClient ?? null;
  customStorage = storage ?? null;
}

function getApiClient(): MobileApiClient {
  if (!customApiClient) {
    customApiClient = new MobileApiClient();
  }
  return customApiClient;
}

function getStorage(): StorageAdapter {
  return customStorage ?? getDefaultStorage();
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  usuario: null,
  estado: 'NO_AUTENTICADO',
  error: null,

  iniciarSesion: async (usuario: string, clave: string): Promise<boolean> => {
    const usuarioLimpio = usuario.trim();
    if (!usuarioLimpio || !clave) {
      set({ error: 'Ingrese su nombre de usuario y contraseña' });
      return false;
    }

    set({ estado: 'CARGANDO', error: null });

    try {
      const client = getApiClient();
      const storage = getStorage();

      const res = await client.login(usuarioLimpio, clave);

      await storage.setItem(TOKEN_STORAGE_KEY, res.token);
      await storage.setItem(USER_STORAGE_KEY, JSON.stringify(res.usuario));

      set({
        token: res.token,
        usuario: res.usuario,
        estado: 'AUTENTICADO',
        error: null,
      });

      return true;
    } catch (err) {
      let mensajeError = 'Ocurrió un error al iniciar sesión';

      if (err instanceof CredencialesInvalidasError) {
        mensajeError = 'Usuario o contraseña incorrectos';
      } else if (err instanceof UsuarioInactivoError) {
        mensajeError = err.message || 'El usuario se encuentra inactivo';
      } else if (err instanceof ErrorDeConexion) {
        mensajeError = err.message;
      } else if (err instanceof Error) {
        mensajeError = err.message;
      }

      set({
        estado: 'NO_AUTENTICADO',
        error: mensajeError,
      });

      return false;
    }
  },

  cerrarSesion: async (): Promise<void> => {
    const storage = getStorage();
    await storage.removeItem(TOKEN_STORAGE_KEY);
    await storage.removeItem(USER_STORAGE_KEY);

    set({
      token: null,
      usuario: null,
      estado: 'NO_AUTENTICADO',
      error: null,
    });
  },

  restaurarSesion: async (): Promise<boolean> => {
    try {
      const storage = getStorage();
      const token = await storage.getItem(TOKEN_STORAGE_KEY);
      const userRaw = await storage.getItem(USER_STORAGE_KEY);

      if (token && userRaw) {
        const usuario: UsuarioSesion = JSON.parse(userRaw);
        set({
          token,
          usuario,
          estado: 'AUTENTICADO',
          error: null,
        });
        return true;
      }
    } catch {
      // Si la carga falla o el json es corrupto, se descarta la sesión
    }

    set({
      token: null,
      usuario: null,
      estado: 'NO_AUTENTICADO',
    });
    return false;
  },

  limpiarError: () => set({ error: null }),
}));
