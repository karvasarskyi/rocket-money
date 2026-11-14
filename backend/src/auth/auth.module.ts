import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtAdminGuard } from './jwt-admin.guard';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { UsersModule } from '../users/users.module';
import { getJwtSecret } from '../common/config';

@Global()
@Module({
  imports: [
    // The secret is resolved on every sign/verify, not at bootstrap: a missing JWT_SECRET must not crash the
    // serverless function (Nest would call process.exit during DI), it only makes auth endpoints return 503.
    JwtModule.register({
      global: true,
      secretOrKeyProvider: () => getJwtSecret(),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtAdminGuard, TelegramAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtAdminGuard],
})
export class AuthModule {}
