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
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: getJwtSecret() }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtAdminGuard, TelegramAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtAdminGuard],
})
export class AuthModule {}
