import { ServiceUnavailableException } from '@nestjs/common';

/** Environment variables the app needs at runtime. Only names are ever reported, never values. */
export const REQUIRED_ENV = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_USERNAME',
  'JWT_SECRET',
  'APP_URL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
] as const;
export const RECOMMENDED_ENV = ['DIRECT_URL', 'TELEGRAM_WEBHOOK_SECRET'] as const;

export function getMissingEnv(names: readonly string[] = REQUIRED_ENV): string[] {
  return names.filter(name => {
    if (name === 'APP_URL') return !getAppUrl();
    if (name === 'JWT_SECRET') return !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16;
    return !(process.env[name] || '').trim();
  });
}

/** Thrown when a request needs configuration that is missing. Mapped to a 503 JSON response. */
export function misconfigured(name: string, hint = ''): ServiceUnavailableException {
  return new ServiceUnavailableException(
    `Server is not configured: ${name} is not set. Add it in Vercel → Settings → Environment Variables and redeploy.${hint ? ' ' + hint : ''}`,
  );
}

/**
 * Resolved lazily (per sign/verify), so a missing secret never crashes the app at startup.
 * In production a missing/short secret makes auth endpoints answer 503 with a clear message.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') throw misconfigured('JWT_SECRET', '(must be at least 16 characters)');
  return 'dev-only-insecure-jwt-secret-change-me';
}

export function getAppUrl(): string {
  const raw = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return raw.replace(/\/+$/, '');
}

export function getAdminTelegramIds(): string[] {
  return (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function getBotUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
}

export function buildReferralLink(code: string): string {
  const bot = getBotUsername();
  return bot ? `https://t.me/${bot}?start=${code}` : `${getAppUrl()}/?ref=${code}`;
}
