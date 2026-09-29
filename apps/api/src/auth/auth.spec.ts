import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Usuario } from './domain/usuario';
import { TokenService } from './infrastructure/token.service';
import { LoginUseCase } from './application/login.usecase';
import { KyselyUsuarioRepository } from './infrastructure/adapters/kysely-usuario.repository';
import { AuthGuard } from './infrastructure/guards/auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { ROLES_KEY } from './infrastructure/decorators/roles.decorator';

describe('Autenticación y Roles (GAF-8 / Spec §12 y Decisión C10)', () => {
  let tokenService: TokenService;
  let usuarioRepo: KyselyUsuarioRepository;
  let loginUseCase: LoginUseCase;

  beforeEach(() => {
    tokenService = new TokenService();
    usuarioRepo = new KyselyUsuarioRepository();
    loginUseCase = new LoginUseCase(usuarioRepo, tokenService);
  });

  describe('1. Entidad Usuario y Verificación de Clave', () => {
    it('genera hash y verifica clave correcta e incorrecta con PBKDF2', () => {
      const hash = Usuario.generarHashPassword('ClaveSecreta123!');
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

      expect(usuario.verificarPassword('ClaveSecreta123!')).toBe(true);
      expect(usuario.verificarPassword('ClaveErrada!')).toBe(false);
      expect(usuario.verificarPassword('')).toBe(false);
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

  describe('3. Caso de Uso de Login (LoginUseCase)', () => {
    it('autentica exitosamente al Administrador en la Web', async () => {
      const resp = await loginUseCase.ejecutar({
        usuario: 'r.agarate',
        clave: 'Admin123!',
        cliente: 'web',
      });

      expect(resp.token).toBeDefined();
      expect(resp.usuario.usuario).toBe('R.AGARATE');
      expect(resp.usuario.cargo).toBe('ADMINISTRADOR');
    });

    it('autentica exitosamente al Supervisor en la Web', async () => {
      const resp = await loginUseCase.ejecutar({
        usuario: 'd.amamani',
        clave: 'Super123!',
        cliente: 'web',
      });

      expect(resp.token).toBeDefined();
      expect(resp.usuario.cargo).toBe('SUPERVISOR');
    });

    it('autentica exitosamente al Técnico Operador en la App Móvil', async () => {
      const resp = await loginUseCase.ejecutar({
        usuario: 'j.perez',
        clave: 'Tecnico123!',
        cliente: 'mobile',
      });

      expect(resp.token).toBeDefined();
      expect(resp.usuario.cargo).toBe('TECNICO_OPERADOR');
    });

    it('RECHAZA al Técnico Operador si intenta ingresar desde la Web (Spec §12 / C10 / §16)', async () => {
      await expect(
        loginUseCase.ejecutar({
          usuario: 'j.perez',
          clave: 'Tecnico123!',
          cliente: 'web',
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'El rol TECNICO_OPERADOR solo tiene acceso a la aplicación móvil (decisión C10, §16)',
        ),
      );
    });

    it('rechaza usuario inexistente con 401', async () => {
      await expect(
        loginUseCase.ejecutar({
          usuario: 'usuario_fantasma',
          clave: 'cualquiera',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza clave equivocada con 401', async () => {
      await expect(
        loginUseCase.ejecutar({
          usuario: 'r.agarate',
          clave: 'ClaveEquivocada',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('4. Guards de Autenticación y Autorización (RBAC)', () => {
    let authGuard: AuthGuard;
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      authGuard = new AuthGuard(tokenService);
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    it('AuthGuard valida encabezado Bearer y asigna req.user', () => {
      const usuario = new Usuario('u1', '1', 'A', 'B', 'ADMINISTRADOR', '1', 'user', 'h');
      const token = tokenService.generarToken(usuario);

      const mockRequest: any = {
        headers: { authorization: `Bearer ${token}` },
      };
      const mockContext: any = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      };

      const permitido = authGuard.canActivate(mockContext);
      expect(permitido).toBe(true);
      expect(mockRequest.user.cargo).toBe('ADMINISTRADOR');
    });

    it('AuthGuard rechaza si falta encabezado o prefijo Bearer', () => {
      const mockReqSinHeader: any = { headers: {} };
      const ctx1: any = { switchToHttp: () => ({ getRequest: () => mockReqSinHeader }) };
      expect(() => authGuard.canActivate(ctx1)).toThrow(UnauthorizedException);

      const mockReqSinBearer: any = { headers: { authorization: 'Basic 12345' } };
      const ctx2: any = { switchToHttp: () => ({ getRequest: () => mockReqSinBearer }) };
      expect(() => authGuard.canActivate(ctx2)).toThrow(UnauthorizedException);
    });

    it('RolesGuard permite acceso cuando el rol coincide', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMINISTRADOR']);

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { cargo: 'ADMINISTRADOR' } }),
        }),
      };

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('RolesGuard deniega acceso (403) cuando el rol no coincide', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMINISTRADOR']);

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { cargo: 'SUPERVISOR' } }),
        }),
      };

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
