import * as crypto from 'crypto';
import { TelegramUser } from '../common/types';

export interface VerifiedInitData {
  user: TelegramUser;
  startParam?: string;
  authDate: number;
}

const MAX_AGE_SECONDS = 24 * 60 * 60;

export const DEV_MOCK_USER: TelegramUser = { id: 12345, first_name: 'TestUser', username: 'testuser' };

/**
 * Verify Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Returns the parsed user, or null if the signature is invalid / expired.
 */
export function verifyInitData(initData: string, botToken: string): VerifiedInitData | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (!user || typeof user.id !== 'number') return null;

  return { user, startParam: params.get('start_param') || undefined, authDate };
}

/** Dev-mode bypass is only allowed outside production, and only when initData is empty. */
export function isDevBypassAllowed(initData: string | undefined): boolean {
  return process.env.NODE_ENV !== 'production' && !initData;
}
