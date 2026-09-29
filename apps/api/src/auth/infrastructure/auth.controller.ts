import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginResponse } from '@gafer/contracts';
import { LoginUseCase } from '../application/login.usecase';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { TokenPayload } from '../domain/ports/token.service.port';

@ApiTags('Autenticación y Roles')
@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica un usuario y devuelve su token JWT y perfil. Los usuarios con rol TECNICO_OPERADOR solo pueden iniciar sesión con cliente mobile (Spec §12 / §16).',
  })
  @ApiResponse({ status: 200, description: 'Sesión iniciada exitosamente' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado (usuario inactivo o técnico intentando acceder a web)',
  })
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.loginUseCase.ejecutar(dto);
  }

  @Get('perfil')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description: 'Devuelve los datos de la sesión activa a partir del token Bearer.',
  })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado / Token inválido o expirado' })
  async obtenerPerfil(@UsuarioActual() usuario: TokenPayload): Promise<TokenPayload> {
    return usuario;
  }

  @Get('verificar-admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ruta exclusiva para rol Administrador' })
  async verificarAdmin(@UsuarioActual() usuario: TokenPayload) {
    return { autorizado: true, rol: usuario.cargo, mensaje: 'Acceso concedido a Administrador' };
  }

  @Get('verificar-gestion')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'SUPERVISOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ruta exclusiva para Administrador o Supervisor' })
  async verificarGestion(@UsuarioActual() usuario: TokenPayload) {
    return { autorizado: true, rol: usuario.cargo, mensaje: 'Acceso concedido a Gestión' };
  }
}
