import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './infrastructure/auth.controller';
import { LoginUseCase } from './application/login.usecase';
import { TokenService } from './infrastructure/token.service';
import { TOKEN_SERVICE } from './domain/ports/token.service.port';
import { KyselyUsuarioRepository } from './infrastructure/adapters/kysely-usuario.repository';
import { USUARIO_REPOSITORY } from './domain/ports/usuario.repository';
import { AuthGuard } from './infrastructure/guards/auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    TokenService,
    {
      provide: TOKEN_SERVICE,
      useClass: TokenService,
    },
    KyselyUsuarioRepository,
    {
      provide: USUARIO_REPOSITORY,
      useClass: KyselyUsuarioRepository,
    },
    AuthGuard,
    RolesGuard,
  ],
  exports: [
    TOKEN_SERVICE,
    USUARIO_REPOSITORY,
    TokenService,
    AuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
