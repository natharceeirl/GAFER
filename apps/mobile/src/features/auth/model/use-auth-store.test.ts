import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useAuthStore,
  configurarDependenciasAuth,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from './use-auth-store';
import { MemoryStorageAdapter } from '../../../shared/storage/storage-adapter';
import {
  MobileApiClient,
  CredencialesInvalidasError,
  UsuarioInactivoError,
  ErrorDeConexion,
} from '../../../shared/api/api-client';

describe('useAuthStore', () => {
  let memoryStorage: MemoryStorageAdapter;
  let mockApiClient: MobileApiClient;

  const mockUsuario = {
    id: 'f9b5a86d-318e-49b4-b91c-bf1b56950711',
    dni: '48765432',
    nombres: 'Roberto',
    apellidos: 'Gomez',
    cargo: 'TECNICO_OPERADOR' as const,
    usuario: 'RGOMEZ_TEC',
  };

  beforeEach(() => {
    memoryStorage = new MemoryStorageAdapter();
    mockApiClient = new MobileApiClient('http://test', vi.fn());

    configurarDependenciasAuth(mockApiClient, memoryStorage);

    // Reset store state
    useAuthStore.setState({
      token: null,
      usuario: null,
      estado: 'NO_AUTENTICADO',
      error: null,
    });
  });

  it('inicia en estado NO_AUTENTICADO sin token ni usuario', () => {
    const state = useAuthStore.getState();
    expect(state.estado).toBe('NO_AUTENTICADO');
    expect(state.token).toBeNull();
    expect(state.usuario).toBeNull();
    expect(state.error).toBeNull();
  });

  it('inicia sesión exitosamente, actualiza el estado y persiste en storage', async () => {
    vi.spyOn(mockApiClient, 'login').mockResolvedValue({
      token: 'jwt-token-123',
      usuario: mockUsuario,
    });

    const exito = await useAuthStore.getState().iniciarSesion('rgomez', 'Gafer2026!NuevaTec');

    expect(exito).toBe(true);
    const state = useAuthStore.getState();
    expect(state.estado).toBe('AUTENTICADO');
    expect(state.token).toBe('jwt-token-123');
    expect(state.usuario?.usuario).toBe('RGOMEZ_TEC');
    expect(state.error).toBeNull();

    // Validar persistencia
    expect(await memoryStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-token-123');
    expect(await memoryStorage.getItem(USER_STORAGE_KEY)).toBe(JSON.stringify(mockUsuario));
  });

  it('rechaza login con campos vacíos antes de llamar a la API', async () => {
    const loginSpy = vi.spyOn(mockApiClient, 'login');

    const exito = await useAuthStore.getState().iniciarSesion('', '');

    expect(exito).toBe(false);
    expect(loginSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().error).toBe('Ingrese su nombre de usuario y contraseña');
  });

  it('maneja error 401 CredencialesInvalidasError', async () => {
    vi.spyOn(mockApiClient, 'login').mockRejectedValue(new CredencialesInvalidasError());

    const exito = await useAuthStore.getState().iniciarSesion('user', 'badpass');

    expect(exito).toBe(false);
    const state = useAuthStore.getState();
    expect(state.estado).toBe('NO_AUTENTICADO');
    expect(state.error).toBe('Usuario o contraseña incorrectos');
  });

  it('maneja error 403 UsuarioInactivoError', async () => {
    vi.spyOn(mockApiClient, 'login').mockRejectedValue(
      new UsuarioInactivoError('Personal suspendido o inactivo'),
    );

    const exito = await useAuthStore.getState().iniciarSesion('inactivo', 'pass');

    expect(exito).toBe(false);
    const state = useAuthStore.getState();
    expect(state.error).toBe('Personal suspendido o inactivo');
  });

  it('maneja fallas de red ErrorDeConexion', async () => {
    vi.spyOn(mockApiClient, 'login').mockRejectedValue(new ErrorDeConexion());

    const exito = await useAuthStore.getState().iniciarSesion('user', 'pass');

    expect(exito).toBe(false);
    const state = useAuthStore.getState();
    expect(state.error).toBe('Sin conexión con el servidor. Verifique su red.');
  });

  it('cierra sesión y limpia el almacenamiento persistente', async () => {
    // Primero simulamos sesión activa
    useAuthStore.setState({
      token: 'jwt-123',
      usuario: mockUsuario,
      estado: 'AUTENTICADO',
    });
    await memoryStorage.setItem(TOKEN_STORAGE_KEY, 'jwt-123');
    await memoryStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUsuario));

    await useAuthStore.getState().cerrarSesion();

    const state = useAuthStore.getState();
    expect(state.estado).toBe('NO_AUTENTICADO');
    expect(state.token).toBeNull();
    expect(state.usuario).toBeNull();
    expect(await memoryStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(await memoryStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it('restaura sesión previa desde el almacenamiento', async () => {
    await memoryStorage.setItem(TOKEN_STORAGE_KEY, 'jwt-guardado-999');
    await memoryStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUsuario));

    const restaurado = await useAuthStore.getState().restaurarSesion();

    expect(restaurado).toBe(true);
    const state = useAuthStore.getState();
    expect(state.estado).toBe('AUTENTICADO');
    expect(state.token).toBe('jwt-guardado-999');
    expect(state.usuario?.usuario).toBe('RGOMEZ_TEC');
  });

  it('devuelve false en restaurarSesion si el almacenamiento está vacío', async () => {
    const restaurado = await useAuthStore.getState().restaurarSesion();

    expect(restaurado).toBe(false);
    expect(useAuthStore.getState().estado).toBe('NO_AUTENTICADO');
  });
});
