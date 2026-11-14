export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is missing or shorter than 16 characters');
  }
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
