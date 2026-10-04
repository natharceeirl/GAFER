import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Usuario } from './domain/usuario';
import { TokenService } from './infrastructure/token.service';
import { LoginUseCase } from './application/login.usecase';
import { UsuarioRepository } from './domain/ports/usuario.repository';
import { generarHashClave } from './domain/clave-hash';
import { AuthGuard } from './infrastructure/guards/auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { ROLES_KEY } from './infrastructure/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from './infrastructure/decorators/public.decorator';

const CLAVE_ADMIN = 'clave-admin-de-prueba';
const CLAVE_SUPERVISOR = 'clave-supervisor-de-prueba';
const CLAVE_TECNICO = 'clave-tecnico-de-prueba';

class UsuarioRepositoryEnMemoria implements UsuarioRepository {
  constructor(private readonly usuarios: Usuario[]) {}

  async buscarPorUsuario(usuario: string): Promise<Usuario | null> {
    return this.usuarios.find((u) => u.usuario === usuario.trim().toUpperCase()) ?? null;
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }
}

describe('Autenticación y Roles (GAF-8 / Spec §12 y Decisión C10)', () => {
  let tokenService: TokenService;
  let loginUseCase: LoginUseCase;

  beforeAll(async () => {
    const usuarios = [
      new Usuario('u-admin', '10000001', 'Rosa', 'Admin', 'ADMINISTRADOR', '958000001', 'R.ADMIN', await generarHashClave(CLAVE_ADMIN)),
      new Usuario('u-super', '10000002', 'Sara', 'Super', 'SUPERVISOR', '958000002', 'S.SUPER', await generarHashClave(CLAVE_SUPERVISOR)),
      new Usuario('u-tec', '10000003', 'Tomas', 'Tecnico', 'TECNICO_OPERADOR', '958000003', 'T.TECNICO', await generarHashClave(CLAVE_TECNICO)),
      new Usuario('u-sin-clave', '10000004', 'Sin', 'Clave', 'SUPERVISOR', '958000004', 'SIN.CLAVE', null),
      new Usuario('u-inactivo', '10000005', 'Ines', 'Inactiva', 'SUPERVISOR', '958000005', 'I.INACTIVA', await generarHashClave(CLAVE_SUPERVISOR), 'INACTIVO'),
    ];
    tokenService = new TokenService();
    loginUseCase = new LoginUseCase(new UsuarioRepositoryEnMemoria(usuarios), tokenService);
  });

  describe('1. Entidad Usuario y Verificación de Clave', () => {
    it('verifica clave correcta e incorrecta contra el hash guardado', async () => {
      const hash = await generarHashClave('ClaveSecreta123!');
      const usuario = new Usuario(
        'u1',
        '12345678',
        'Juan',
        'Perez',
        'TECNICO_OPERADOR',
        '958123456',
        'J.PEREZ',
        hash,
        'ACTIVO',
      );

      expect(await usuario.verificarPassword('ClaveSecreta123!')).toBe(true);
      expect(await usuario.verificarPassword('ClaveErrada!')).toBe(false);
      expect(await usuario.verificarPassword('')).toBe(false);
    });

    it('un usuario sin clave guardada nunca verifica, ni con la clave vacía ni con el valor del hash', async () => {
      const sinClave = new Usuario('u1', '12345678', 'A', 'B', 'SUPERVISOR', '1', 'sin', null);
      expect(await sinClave.verificarPassword('cualquiera')).toBe(false);
      expect(await sinClave.verificarPassword('')).toBe(false);

      const hashPlano = new Usuario('u2', '12345679', 'A', 'B', 'SUPERVISOR', '1', 'plano', 'texto-plano');
      expect(await hashPlano.verificarPassword('texto-plano')).toBe(false);
    });

    it('restringe acceso a la web exclusivamente a Administrador y Supervisor', () => {
      const admin = new Usuario('u1', '12345678', 'A', 'B', 'ADMINISTRADOR', '1', 'admin', 'h');
      const superv = new Usuario('u2', '12345679', 'C', 'D', 'SUPERVISOR', '2', 'superv', 'h');
      const tecnico = new Usuario('u3', '12345670', 'E', 'F', 'TECNICO_OPERADOR', '3', 'tec', 'h');

      expect(admin.puedeAccederAWeb()).toBe(true);
      expect(superv.puedeAccederAWeb()).toBe(true);
      expect(tecnico.puedeAccederAWeb()).toBe(false);
    });
  });

  describe('2. Servicio de Tokens JWT (TokenService)', () => {
    it('genera y valida un token firmado correctamente', () => {
      const usuario = new Usuario(
        'u1',
        '10000001',
        'Roberto',
        'Agarate',
        'ADMINISTRADOR',
        '958000001',
        'R.AGARATE',
        'h',
      );

      const token = tokenService.generarToken(usuario);
      expect(typeof token).toBe('string');

      const payload = tokenService.verificarToken(token);
      expect(payload.usuario).toBe('R.AGARATE');
      expect(payload.cargo).toBe('ADMINISTRADOR');
      expect(payload.nombreCompleto).toBe('Roberto Agarate');
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('rechaza tokens con firma adulterada o formato inválido', () => {
      expect(() => tokenService.verificarToken('')).toThrow(UnauthorizedException);
      expect(() => tokenService.verificarToken('token.invalido')).toThrow(UnauthorizedException);

      const tokenValido = tokenService.generarToken(
        new Usuario('u1', '1', 'A', 'B', 'SUPERVISOR', '1', 'user', 'h'),
      );
      const tokenModificado = tokenValido.slice(0, -5) + 'xxxxx';
      expect(() => tokenService.verificarToken(tokenModificado)).toThrow(UnauthorizedException);
    });
  });

  describe('2b. Secreto JWT obligatorio y expiración', () => {
    const secretoOriginal = process.env.JWT_SECRET;

    afterEach(() => {
      process.env.JWT_SECRET = secretoOriginal;
    });

    it('no arranca sin JWT_SECRET, con un mensaje que dice qué falta', () => {
      delete process.env.JWT_SECRET;
      expect(() => new TokenService()).toThrow(/JWT_SECRET/);
    });

    it('no arranca con un JWT_SECRET demasiado corto', () => {
      process.env.JWT_SECRET = 'corto';
      expect(() => new TokenService()).toThrow(/32/);
    });

    it('rechaza un token vencido y uno firmado con otro secreto', () => {
      const usuario = new Usuario('u1', '1', 'A', 'B', 'SUPERVISOR', '1', 'user', null);
      const token = tokenService.generarToken(usuario);

      const ahora = Date.now();
      const spy = jest.spyOn(Date, 'now').mockReturnValue(ahora + 9 * 3600 * 1000);
      try {
        expect(() => tokenService.verificarToken(token)).toThrow(UnauthorizedException);
      } finally {
        spy.mockRestore();
      }

      process.env.JWT_SECRET = 'otro-secreto-distinto-para-pruebas-0123456789';
      expect(() => new TokenService().verificarToken(token)).toThrow(UnauthorizedException);
    });
  });

  describe('3. Caso de Uso de Login (LoginUseCase)', () => {
    it('autentica exitosamente al Administrador en la Web', async () => {
      const resp = await loginUseCase.ejecutar({ usuario: 'r.admin', clave: CLAVE_ADMIN, cliente: 'web' });

      expect(resp.token).toBeDefined();
      expect(resp.usuario.usuario).toBe('R.ADMIN');
      expect(resp.usuario.cargo).toBe('ADMINISTRADOR');
    });

    it('autentica exitosamente al Supervisor en la Web', async () => {
      const resp = await loginUseCase.ejecutar({ usuario: 's.super', clave: CLAVE_SUPERVISOR, cliente: 'web' });

      expect(resp.token).toBeDefined();
      expect(resp.usuario.cargo).toBe('SUPERVISOR');
    });

    it('autentica exitosamente al Técnico Operador en la App Móvil', async () => {
      const resp = await loginUseCase.ejecutar({ usuario: 't.tecnico', clave: CLAVE_TECNICO, cliente: 'mobile' });

      expect(resp.token).toBeDefined();
      expect(resp.usuario.cargo).toBe('TECNICO_OPERADOR');
    });

    it('RECHAZA al Técnico Operador si intenta ingresar desde la Web (Spec §12 / C10 / §16)', async () => {
      await expect(
        loginUseCase.ejecutar({ usuario: 't.tecnico', clave: CLAVE_TECNICO, cliente: 'web' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'El rol TECNICO_OPERADOR solo tiene acceso a la aplicación móvil (decisión C10, §16)',
        ),
      );
    });

    it('rechaza usuario inexistente, clave equivocada y fila sin clave con el mismo 401 genérico', async () => {
      const intentos = [
        { usuario: 'usuario_fantasma', clave: 'cualquiera' },
        { usuario: 'r.admin', clave: 'ClaveEquivocada' },
        { usuario: 'sin.clave', clave: 'cualquiera' },
        { usuario: 'sin.clave', clave: '' },
      ];
      for (const intento of intentos) {
        await expect(loginUseCase.ejecutar({ ...intento, cliente: 'web' })).rejects.toThrow(
          new UnauthorizedException('Credenciales inválidas'),
        );
      }
    });

    it('rechaza con 403 a un usuario inactivo solo cuando la clave es correcta', async () => {
      await expect(
        loginUseCase.ejecutar({ usuario: 'i.inactiva', clave: CLAVE_SUPERVISOR, cliente: 'web' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        loginUseCase.ejecutar({ usuario: 'i.inactiva', clave: 'incorrecta', cliente: 'web' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('4. Guards de Autenticación y Autorización (RBAC)', () => {
    let authGuard: AuthGuard;
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    const contexto = (request: object): any => ({
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => request }),
    });

    /** Simula los metadatos de la ruta: si es pública y qué roles declara. */
    const rutaConMetadatos = (meta: { publica?: boolean; roles?: string[] }) =>
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((clave: unknown) => {
        if (clave === IS_PUBLIC_KEY) return meta.publica;
        if (clave === ROLES_KEY) return meta.roles;
        return undefined;
      });

    beforeEach(() => {
      reflector = new Reflector();
      authGuard = new AuthGuard(tokenService, reflector);
      rolesGuard = new RolesGuard(reflector);
    });

    it('AuthGuard valida encabezado Bearer y asigna req.user', () => {
      rutaConMetadatos({ roles: ['ADMINISTRADOR'] });
      const usuario = new Usuario('u1', '1', 'A', 'B', 'ADMINISTRADOR', '1', 'user', null);
      const token = tokenService.generarToken(usuario);

      const request: any = { headers: { authorization: `Bearer ${token}` } };

      expect(authGuard.canActivate(contexto(request))).toBe(true);
      expect(request.user.cargo).toBe('ADMINISTRADOR');
    });

    it('AuthGuard rechaza con 401 si falta encabezado, prefijo Bearer o el token es inválido', () => {
      rutaConMetadatos({ roles: ['ADMINISTRADOR'] });

      expect(() => authGuard.canActivate(contexto({ headers: {} }))).toThrow(UnauthorizedException);
      expect(() => authGuard.canActivate(contexto({ headers: { authorization: 'Basic 12345' } }))).toThrow(
        UnauthorizedException,
      );
      expect(() => authGuard.canActivate(contexto({ headers: { authorization: 'Bearer basura.basura.basura' } }))).toThrow(
        UnauthorizedException,
      );
    });

    it('AuthGuard deja pasar sin token solo las rutas marcadas como públicas', () => {
      rutaConMetadatos({ publica: true });
      const request: any = { headers: {} };

      expect(authGuard.canActivate(contexto(request))).toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('RolesGuard permite acceso cuando el rol coincide', () => {
      rutaConMetadatos({ roles: ['ADMINISTRADOR'] });

      expect(rolesGuard.canActivate(contexto({ user: { cargo: 'ADMINISTRADOR' } }))).toBe(true);
    });

    it('RolesGuard deniega acceso (403) cuando el rol no coincide', () => {
      rutaConMetadatos({ roles: ['ADMINISTRADOR'] });

      expect(() => rolesGuard.canActivate(contexto({ user: { cargo: 'SUPERVISOR' } }))).toThrow(ForbiddenException);
    });

    it('RolesGuard falla cerrado: una ruta no pública sin @Roles responde 403 aunque haya sesión', () => {
      rutaConMetadatos({});
      expect(() => rolesGuard.canActivate(contexto({ user: { cargo: 'ADMINISTRADOR' } }))).toThrow(ForbiddenException);

      rutaConMetadatos({ roles: [] });
      expect(() => rolesGuard.canActivate(contexto({ user: { cargo: 'ADMINISTRADOR' } }))).toThrow(ForbiddenException);
    });

    it('RolesGuard deniega una ruta con roles si no hay sesión', () => {
      rutaConMetadatos({ roles: ['ADMINISTRADOR'] });

      expect(() => rolesGuard.canActivate(contexto({}))).toThrow(ForbiddenException);
    });

    it('RolesGuard no exige roles en una ruta pública', () => {
      rutaConMetadatos({ publica: true });

      expect(rolesGuard.canActivate(contexto({}))).toBe(true);
    });
  });
});
