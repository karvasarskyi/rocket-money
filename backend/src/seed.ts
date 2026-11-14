/**
 * Idempotent seed: creates default system settings and the first administrator.
 * Runs automatically during the Vercel build (if DATABASE_URL is set) and can be run manually: `npm run db:seed`.
 * Admin credentials come from ADMIN_USERNAME / ADMIN_PASSWORD. An existing admin's password is only
 * changed when ADMIN_RESET_PASSWORD=true.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SettingsService } from './settings/settings.service';

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.systemSettings.createMany({ data: SettingsService.DEFAULTS, skipDuplicates: true });
    console.log('[seed] Default settings ensured');

    const username = (process.env.ADMIN_USERNAME || '').trim();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!username || !password) {
      console.log('[seed] ADMIN_USERNAME / ADMIN_PASSWORD not set – skipping admin creation');
      return;
    }
    if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

    const existing = await prisma.admin.findUnique({ where: { username } });
    if (!existing) {
      await prisma.admin.create({ data: { username, password: await bcrypt.hash(password, 10) } });
      console.log(`[seed] Admin "${username}" created`);
    } else if (process.env.ADMIN_RESET_PASSWORD === 'true') {
      await prisma.admin.update({ where: { username }, data: { password: await bcrypt.hash(password, 10) } });
      console.log(`[seed] Admin "${username}" password reset`);
    } else {
      console.log(`[seed] Admin "${username}" already exists`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
