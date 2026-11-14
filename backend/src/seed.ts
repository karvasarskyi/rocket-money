/**
 * Idempotent seed: default system settings and the first administrator.
 * Runs during the Vercel build (if DATABASE_URL is set), once on every server start, and manually: `npm run db:seed`.
 */
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './common/seed-database';

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
