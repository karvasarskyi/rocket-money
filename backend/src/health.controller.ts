import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';
import { getAppUrl, getBotUsername, getMissingEnv, RECOMMENDED_ENV } from './common/config';

/** Builds the env part of the health report. Names only – never secret values. */
export function envReport() {
  return {
    missingEnv: getMissingEnv(),
    missingRecommendedEnv: getMissingEnv(RECOMMENDED_ENV),
    config: {
      TELEGRAM_BOT_USERNAME: getBotUsername() || null,
      APP_URL: getAppUrl() || null,
      NODE_ENV: process.env.NODE_ENV || null,
    },
  };
}

@Controller('api')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Deployment self-check. Always answers JSON: 200 when fully ready, 503 otherwise (with the reason). */
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const env = envReport();
    let database = 'ok';
    let migrations = 'ok';
    let adminExists: boolean | null = null;

    if (env.missingEnv.includes('DATABASE_URL')) {
      database = 'not configured (DATABASE_URL missing)';
      migrations = 'unknown';
    } else {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        try {
          await this.prisma.systemSettings.count();
          adminExists = (await this.prisma.admin.count()) > 0;
        } catch {
          migrations = 'missing – run prisma migrate deploy (or redeploy with DATABASE_URL and DIRECT_URL set)';
        }
      } catch (err) {
        database = `error: ${(err as Error).message.split('\n').filter(Boolean).pop()?.trim().slice(0, 200)}`;
        migrations = 'unknown';
      }
    }

    const ok = database === 'ok' && migrations === 'ok' && env.missingEnv.length === 0;
    res.status(ok ? 200 : 503);
    return {
      status: ok ? 'ok' : 'degraded',
      database,
      migrations,
      adminExists,
      ...env,
      time: new Date().toISOString(),
    };
  }
}
