import {
  LoginRequest,
  LoginResponse,
  LoginResponseSchema,
  ResumenServicioTecnico,
  ResumenServicioTecnicoSchema,
  SolicitudCorreccion,
  SolicitudCorreccionSchema,
} from '@gafer/contracts';

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

export const DEFAULT_DEV_API_URL = 'http://192.168.18.205:3000';

/**
 * Resuelve la URL base de la API según variables de entorno o valor por defecto.
 * En desarrollo local por Wi-Fi, prefiere la IP de la máquina de desarrollo sobre 10.0.2.2.
 */
export function obtenerBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL.trim();
    if (envUrl.includes('10.0.2.2') || envUrl.includes('localhost')) {
      return DEFAULT_DEV_API_URL;
    }
    return envUrl;
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

  /**
   * Consulta el listado de servicios cerrados donde participó el técnico autenticado (GAF-104).
   * Se consume en modo solo lectura para auditoría y consulta en campo.
   */
  async obtenerMisServicios(token?: string): Promise<ResumenServicioTecnico[]> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(
        `${this.activeBaseUrl}/api/operaciones/inspecciones/mis-servicios`,
        {
          method: 'GET',
          headers,
          signal: controller.signal as any,
        },
      );

      if (!response.ok) {
        throw new ApiError(`Error al consultar mis servicios (${response.status})`, response.status);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new ApiError('Respuesta inesperada: se esperaba un listado de servicios', response.status);
      }
      return data.map((item) => ResumenServicioTecnicoSchema.parse(item));
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      throw new ErrorDeConexion(`No se pudo conectar para listar servicios en ${this.activeBaseUrl}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Envía una solicitud formal de corrección para un servicio cerrado (GAF-104).
   * Registra el motivo en auditoría para que lo gestione o autorice supervisión.
   */
  async solicitarCorreccion(
    inspeccionId: string,
    motivo: string,
    token?: string,
  ): Promise<{ ok: boolean; mensaje: string; inspeccionId: string; solicitadaEn: string }> {
    const payload: SolicitudCorreccion = { motivo: motivo.trim() };
    SolicitudCorreccionSchema.parse(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(
        `${this.activeBaseUrl}/api/operaciones/inspecciones/${inspeccionId}/solicitar-correccion`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal as any,
        },
      );

      if (!response.ok) {
        let errorData: any = null;
        try {
          errorData = await response.json();
        } catch {}
        const mensaje = errorData?.message || `Error al solicitar corrección (${response.status})`;
        throw new ApiError(mensaje, response.status, errorData);
      }

      return (await response.json()) as {
        ok: boolean;
        mensaje: string;
        inspeccionId: string;
        solicitadaEn: string;
      };
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      throw new ErrorDeConexion(`No se pudo conectar para solicitar corrección en ${this.activeBaseUrl}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
