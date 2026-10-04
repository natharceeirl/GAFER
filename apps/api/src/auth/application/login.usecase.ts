import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginRequest, LoginResponse } from '@gafer/contracts';
import { verificarContraHashFicticio } from '../domain/clave-hash';
import {
  UsuarioRepository,
  USUARIO_REPOSITORY,
} from '../domain/ports/usuario.repository';
import {
  TokenServicePort,
  TOKEN_SERVICE,
} from '../domain/ports/token.service.port';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepository,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
  ) {}

  async ejecutar(dto: LoginRequest): Promise<LoginResponse> {
    const usuario = await this.usuarioRepo.buscarPorUsuario(dto.usuario);

    // Siempre se calcula un hash (aunque el usuario no exista o no tenga clave) para que el tiempo
    // de respuesta y el mensaje de error no revelen si el usuario existe.
    const claveValida = usuario?.tieneClave()
      ? await usuario.verificarPassword(dto.clave)
      : await verificarContraHashFicticio(dto.clave);

    if (!usuario || !claveValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new ForbiddenException('El usuario se encuentra inactivo');
    }

    const clienteOrigen = dto.cliente || 'web';

    // Regla de Negocio C10 / Spec §12 y §16:
    // El Técnico Operador trabaja exclusivamente desde la app Android (offline-first).
    // La interfaz web no admite acceso para el rol de Técnico Operador.
    if (clienteOrigen === 'web' && !usuario.puedeAccederAWeb()) {
      throw new ForbiddenException(
        'El rol TECNICO_OPERADOR solo tiene acceso a la aplicación móvil (decisión C10, §16)',
      );
    }

    const token = this.tokenService.generarToken(usuario);

    return {
      token,
      usuario: {
        id: usuario.id,
        dni: usuario.dni,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        cargo: usuario.cargo,
        usuario: usuario.usuario,
      },
    };
  }
}
