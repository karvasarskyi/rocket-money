import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SettingsService } from '../settings/settings.service';

/**
 * Idempotent: default system settings + the first administrator from ADMIN_USERNAME / ADMIN_PASSWORD.
 * An existing admin's password is only changed when ADMIN_RESET_PASSWORD=true.
 * Used by the build-time seed (dist/seed.js) and once per server start (runtime fallback).
 */
export async function seedDatabase(prisma: PrismaClient, log: (msg: string) => void = console.log): Promise<void> {
  await prisma.systemSettings.createMany({ data: SettingsService.DEFAULTS, skipDuplicates: true });
  log('[seed] Default settings ensured');

  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!username || !password) {
    log('[seed] ADMIN_USERNAME / ADMIN_PASSWORD not set – skipping admin creation');
    return;
  }
  if (password.length < 8) {
    log('[seed] ADMIN_PASSWORD must be at least 8 characters – skipping admin creation');
    return;
  }

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (!existing) {
    await prisma.admin.create({ data: { username, password: await bcrypt.hash(password, 10) } });
    log(`[seed] Admin "${username}" created`);
  } else if (process.env.ADMIN_RESET_PASSWORD === 'true') {
    await prisma.admin.update({ where: { username }, data: { password: await bcrypt.hash(password, 10) } });
    log(`[seed] Admin "${username}" password reset`);
  } else {
    log(`[seed] Admin "${username}" already exists`);
  }
}

/** Runtime fallback: never throws and never blocks startup for more than `timeoutMs`. */
export async function seedDatabaseSafely(prisma: PrismaClient, timeoutMs = 8000): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      seedDatabase(prisma, () => undefined),
      new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs))),
    ]);
  } catch (err) {
    console.warn('[seed] Runtime seed skipped:', (err as Error).message.split('\n').filter(Boolean).pop());
  } finally {
    if (timer) clearTimeout(timer);
  }
}
