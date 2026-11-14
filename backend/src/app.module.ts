import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { WalletModule } from './wallet/wallet.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReferralsModule } from './referrals/referrals.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { TelegramModule } from './telegram/telegram.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

// Static admin panel: on Vercel it is served from frontend/dist/admin (copied at build time);
// when running the standalone server (`npm run start:prod` / Docker) main.ts serves backend/public/admin.
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    SettingsModule,
    WalletModule,
    AuthModule,
    UsersModule,
    ReferralsModule,
    WithdrawalsModule,
    TelegramModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
