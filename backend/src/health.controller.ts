import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { getAppUrl, getBotUsername } from './common/config';

@Controller('api')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Deployment self-check. Never returns secret values – only whether they are configured. */
  @Get('health')
  async health() {
    let database = 'ok';
    let migrations = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      try {
        await this.prisma.systemSettings.count();
      } catch {
        migrations = 'missing – run prisma migrate deploy';
      }
    } catch (err) {
      database = `error: ${(err as Error).message.split('\n')[0]}`;
      migrations = 'unknown';
    }
    return {
      status: database === 'ok' && migrations === 'ok' ? 'ok' : 'degraded',
      database,
      migrations,
      config: {
        TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_BOT_USERNAME: getBotUsername() || null,
        TELEGRAM_WEBHOOK_SECRET: !!process.env.TELEGRAM_WEBHOOK_SECRET,
        JWT_SECRET: !!process.env.JWT_SECRET,
        APP_URL: getAppUrl() || null,
        NODE_ENV: process.env.NODE_ENV || null,
      },
      time: new Date().toISOString(),
    };
  }
}
