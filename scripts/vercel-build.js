#!/usr/bin/env node
/**
 * Build pipeline used by Vercel (`npm run vercel-build`) and locally (`npm run build`).
 *  1. prisma generate            – generates the Prisma client (incl. Vercel's rhel-openssl-3.0.x engine)
 *  2. nest build                 – compiles the backend into backend/dist (used by api/index.ts)
 *  3. prisma migrate deploy      – applies database migrations   (only if DATABASE_URL is set)
 *  4. seed                       – default settings + first admin (only if DATABASE_URL is set)
 *  5. vite build                 – builds the Mini App into frontend/dist
 *  6. copy admin panel           – backend/public/admin -> frontend/dist/admin
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');

function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}  (in ${path.relative(root, cwd) || '.'})`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

/** Database steps must not fail the deploy: /api/health reports the problem and the app seeds itself on start. */
function tryRun(cmd, cwd) {
  try {
    run(cmd, cwd);
    return true;
  } catch (err) {
    console.warn(`\n⚠ "${cmd}" failed (${err.status ?? err.message}). Continuing the build – check /api/health after deploy.`);
    return false;
  }
}

const onVercel = !!process.env.VERCEL;
const hasDb = !!(process.env.DATABASE_URL || process.env.DIRECT_URL);
if (!process.env.DATABASE_URL && process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
  console.log('ℹ DATABASE_URL not set – using DIRECT_URL for the build steps (set DATABASE_URL for runtime too).');
}
if (hasDb && !process.env.DIRECT_URL) {
  // schema.prisma declares directUrl, so Prisma needs DIRECT_URL. Fall back to DATABASE_URL.
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  console.log('ℹ DIRECT_URL not set – using DATABASE_URL for migrations.');
}
// `prisma generate` validates env() references; provide harmless values when no database is configured.
const placeholder = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = placeholder;
if (!process.env.DIRECT_URL) process.env.DIRECT_URL = placeholder;

run('npx prisma generate', backend);
run('npm run build', backend);

if (hasDb && process.env.SKIP_MIGRATIONS !== 'true') {
  if (tryRun('npx prisma migrate deploy', backend)) tryRun('node dist/seed.js', backend);
} else if (onVercel) {
  console.warn('\n⚠ DATABASE_URL is not set – skipping migrations. Add it in Vercel → Settings → Environment Variables and redeploy.');
} else {
  console.log('\nℹ DATABASE_URL not set – skipping migrations and seed.');
}

run('npm run build', frontend);

const src = path.join(backend, 'public', 'admin');
const dest = path.join(frontend, 'dist', 'admin');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`\n✔ Admin panel copied to ${path.relative(root, dest)}`);

if (onVercel) {
  const missing = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'].filter(k => !process.env[k]);
  if (!process.env.APP_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL) missing.push('APP_URL');
  if (!hasDb) missing.push('DATABASE_URL');
  if (missing.length) console.warn(`\n⚠ Missing environment variables: ${missing.join(', ')}. The app will not fully work until they are added.`);
}
console.log('\n✅ Build complete');
