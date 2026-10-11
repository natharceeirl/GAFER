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
  constructor(mensaje = 'No se pudo conectar con el servidor. Verifique su conexión a internet.') {
    super(mensaje);
    this.name = 'ErrorDeConexion';
  }
}

/**
 * Resuelve la URL base de la API según las variables de entorno y el entorno de ejecución.
 * Para emuladores Android oficiales de Google, 10.0.2.2 mapea a 127.0.0.1 de la máquina anfitriona.
 */
export function obtenerBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'http://localhost:3000';
}

export class MobileApiClient {
  constructor(
    private readonly baseUrl: string = obtenerBaseUrl(),
    private readonly fetchFn: typeof fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch,
  ) {}

  /**
   * Autenticación de usuario para cliente móvil (Spec §12, §16 / Decisión C10).
   * Siempre envía cliente: 'mobile' para autorizar el rol TECNICO_OPERADOR.
   */
  async login(usuario: string, clave: string): Promise<LoginResponse> {
    const payload: LoginRequest = {
      usuario: usuario.trim(),
      clave,
      cliente: 'mobile',
    };

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new ErrorDeConexion();
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
