import { describe, it, expect, vi } from 'vitest';
import {
  MobileApiClient,
  CredencialesInvalidasError,
  UsuarioInactivoError,
  ErrorDeConexion,
  ApiError,
} from './api-client';

describe('MobileApiClient', () => {
  const mockUsuario = {
    id: 'f9b5a86d-318e-49b4-b91c-bf1b56950711',
    dni: '48765432',
    nombres: 'Roberto',
    apellidos: 'Gomez',
    cargo: 'TECNICO_OPERADOR' as const,
    usuario: 'RGOMEZ_TEC',
  };

  it('inicia sesión exitosamente enviando cliente: mobile (Decisión C10)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token-valido-123',
        usuario: mockUsuario,
      }),
    });

    const client = new MobileApiClient('http://test-server:3000', mockFetch as any);
    const res = await client.login('  rgomez_tec  ', 'Gafer2026!NuevaTec');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-server:3000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          usuario: 'rgomez_tec',
          clave: 'Gafer2026!NuevaTec',
          cliente: 'mobile',
        }),
        signal: expect.anything(),
      }),
    );

    expect(res.token).toBe('jwt-token-valido-123');
    expect(res.usuario.cargo).toBe('TECNICO_OPERADOR');
  });

  it('lanza CredencialesInvalidasError cuando la API devuelve 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Usuario o clave incorrectos' }),
    });

    const client = new MobileApiClient('http://test-server:3000', mockFetch as any);

    await expect(client.login('rgomez', 'clave-invalida')).rejects.toThrow(
      CredencialesInvalidasError,
    );
  });

  it('lanza UsuarioInactivoError cuando la API devuelve 403', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Personal inactivo en el sistema' }),
    });

    const client = new MobileApiClient('http://test-server:3000', mockFetch as any);

    await expect(client.login('inactivo', 'clave-valida')).rejects.toThrow(
      UsuarioInactivoError,
    );
  });

  it('lanza ErrorDeConexion ante falla de red (fetch rechaza)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network request failed'));

    const client = new MobileApiClient('http://test-server:3000', mockFetch as any);

    await expect(client.login('tecnico', 'clave')).rejects.toThrow(ErrorDeConexion);
  });

  it('lanza ApiError ante errores de servidor 500 u otros códigos', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Error interno en el servidor' }),
    });

    const client = new MobileApiClient('http://test-server:3000', mockFetch as any);

    await expect(client.login('tecnico', 'clave')).rejects.toThrow(ApiError);
  });

  it('permite consultar y actualizar la URL base dinámicamente', () => {
    const client = new MobileApiClient('http://192.168.1.10:3000/');
    expect(client.getBaseUrl()).toBe('http://192.168.1.10:3000');

    client.setBaseUrl('http://10.0.2.2:3000/');
    expect(client.getBaseUrl()).toBe('http://10.0.2.2:3000');
  });

  it('lanza ErrorDeConexion con mensaje claro si la petición expira por timeout', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const client = new MobileApiClient('http://test-server:3000', mockFetch as any);

    await expect(client.login('tecnico', 'clave')).rejects.toThrow(
      /Tiempo de espera agotado al conectar/,
    );
  });

  // Tests GAF-104: Mis servicios y solicitud de corrección
  describe('GAF-104: Mis servicios y correcciones', () => {
    it('obtiene el listado de mis servicios cerrados con encabezado de autorización', async () => {
      const mockServicios = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          servicioId: '22222222-2222-2222-2222-222222222222',
          codigoInspeccion: 'GAFER-2026-001',
          estado: 'CERRADO',
          versionSync: 2,
          fechaEjecucion: '2026-11-03',
          tecnicosParticipantes: [{ id: 'f9b5a86d-318e-49b4-b91c-bf1b56950711', nombre: 'Roberto Gomez' }],
          puedeSolicitarCorreccion: true,
          clienteRazonSocial: 'ALICORP S.A.A.',
          sedeNombre: 'Planta Callao',
          servicioTipo: 'DESINSECTACION Y DESRATIZACION',
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockServicios,
      });

      const client = new MobileApiClient('http://test-server:3000', mockFetch as any);
      const res = await client.obtenerMisServicios('jwt-token-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:3000/api/operaciones/inspecciones/mis-servicios',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token-123',
          }),
        }),
      );
      expect(res).toHaveLength(1);
      expect(res[0].codigoInspeccion).toBe('GAFER-2026-001');
    });

    it('envía solicitud de corrección con motivo validado a supervisión', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mensaje: 'Solicitud de corrección enviada a supervisión exitosamente',
          inspeccionId: '11111111-1111-1111-1111-111111111111',
          solicitadaEn: '2026-11-03T10:00:00.000Z',
        }),
      });

      const client = new MobileApiClient('http://test-server:3000', mockFetch as any);
      const res = await client.solicitarCorreccion(
        '11111111-1111-1111-1111-111111111111',
        'Se digitó erróneamente el número de estación 12 en vez de la 14',
        'jwt-token-123',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:3000/api/operaciones/inspecciones/11111111-1111-1111-1111-111111111111/solicitar-correccion',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token-123',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            motivo: 'Se digitó erróneamente el número de estación 12 en vez de la 14',
          }),
        }),
      );
      expect(res.ok).toBe(true);
    });

    it('rechaza motivo menor a 5 caracteres antes de hacer fetch', async () => {
      const mockFetch = vi.fn();
      const client = new MobileApiClient('http://test-server:3000', mockFetch as any);

      await expect(
        client.solicitarCorreccion('11111111-1111-1111-1111-111111111111', 'abc', 'jwt-token-123'),
      ).rejects.toThrow();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
