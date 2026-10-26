import { LoginRequest, LoginResponse, LoginResponseSchema } from '@gafer/contracts';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly detalles?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class CredencialesInvalidasError extends ApiError {
  constructor(mensaje = 'Usuario o clave incorrectos') {
    super(mensaje, 401);
    this.name = 'CredencialesInvalidasError';
  }
}

export class UsuarioInactivoError extends ApiError {
  constructor(mensaje = 'El usuario se encuentra inactivo') {
    super(mensaje, 403);
    this.name = 'UsuarioInactivoError';
  }
}

export class ErrorDeConexion extends Error {
  constructor(mensaje = 'Sin conexión con el servidor. Verifique su red.') {
    super(mensaje);
    this.name = 'ErrorDeConexion';
  }
}

export const DEFAULT_DEV_API_URL = 'http://192.168.18.119:3000';

/**
 * Detecta automáticamente la IP del host de desarrollo a partir de la URL
 * desde donde Metro sirvió el bundle de JavaScript en el dispositivo físico.
 */
export function detectarHostMetro(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = typeof require !== 'undefined' ? require('react-native') : null;
    const scriptURL = rn?.NativeModules?.SourceCode?.scriptURL;
    if (typeof scriptURL === 'string') {
      const match = scriptURL.match(/https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch {
    // Entorno de test (Vitest/Node) o sin NativeModules
  }
  return null;
}

/**
 * Resuelve la URL base de la API:
 * 1. Detección automática del host de Metro en dispositivo físico (auto-IP).
 * 2. Variable de entorno EXPO_PUBLIC_API_URL.
 * 3. Valor de fallback por defecto.
 */
export function obtenerBaseUrl(): string {
  const hostAuto = detectarHostMetro();
  if (hostAuto) {
    return `http://${hostAuto}:3000`;
  }

  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL.trim();
    if (!envUrl.includes('10.0.2.2') && !envUrl.includes('localhost')) {
      return envUrl;
    }
  }
  return DEFAULT_DEV_API_URL;
}

export class MobileApiClient {
  private activeBaseUrl: string;

  constructor(
    baseUrl: string = obtenerBaseUrl(),
    private readonly fetchFn: typeof fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch,
    private readonly timeoutMs: number = 6000,
  ) {
    this.activeBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  }

  setBaseUrl(url: string): void {
    this.activeBaseUrl = url.trim().replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.activeBaseUrl;
  }

  /**
   * Autenticación de usuario para cliente móvil (Spec §12, §16 / Decisión C10).
   * Siempre envía cliente: 'mobile' para autorizar el rol TECNICO_OPERADOR.
   * Cuenta con AbortController de 6s para evitar bloqueos infinitos de red en Android.
   */
  async login(usuario: string, clave: string): Promise<LoginResponse> {
    const payload: LoginRequest = {
      usuario: usuario.trim(),
      clave,
      cliente: 'mobile',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(`${this.activeBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal as any,
      });
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      if (errorObj?.name === 'AbortError') {
        throw new ErrorDeConexion(
          `Tiempo de espera agotado al conectar con ${this.activeBaseUrl}. Verifique que el servidor API esté iniciado y la IP sea accesible desde su red.`,
        );
      }
      throw new ErrorDeConexion(
        `No se pudo conectar con el servidor en ${this.activeBaseUrl}. Verifique su conexión y la dirección del backend.`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        // Respuesta sin cuerpo JSON
      }

      if (response.status === 401) {
        throw new CredencialesInvalidasError(
          errorData?.message || 'Usuario o clave incorrectos',
        );
      }

      if (response.status === 403) {
        throw new UsuarioInactivoError(
          errorData?.message || 'Usuario inactivo o acceso restringido',
        );
      }

      const mensaje = errorData?.message || `Error del servidor (${response.status})`;
      throw new ApiError(mensaje, response.status, errorData);
    }

    const raw = await response.json();
    return LoginResponseSchema.parse(raw);
  }
}
