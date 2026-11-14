# Rocket Money: Technical Deployment Reference

## Architecture on Vercel

```
                 ┌──────────────────────── Vercel project (one domain) ────────────────────────┐
Telegram ──POST /webhook──▶  rewrite ─▶ api/index.ts (Node 22 serverless) ─▶ NestJS app (backend/dist)
Mini App ──/api/*────────▶  rewrite ─┘                                          │
Browser ──/ , /wallet …──▶  static  frontend/dist (React SPA, fallback to index.html)    │ Prisma
Admin   ──/admin/*───────▶  static  frontend/dist/admin (copied from backend/public/admin)│
                 └─────────────────────────────────────────────────────────────────────────────┘
                                                                                         ▼
                                                                    Neon / Supabase PostgreSQL
```

- **One serverless function** (`api/index.ts`) loads the compiled NestJS app from `backend/dist/serverless.js`. The Nest app is built on an Express adapter and cached per function instance, so warm requests skip bootstrapping.
- **Same origin**: the Mini App calls relative `/api/...` URLs, so you don't need CORS or an API URL variable. No code depends on `localhost` in production. The Vite dev proxy is only used for `npm run dev`.
- **Webhook mode**: the bot never polls. Telegram POSTs updates to `/webhook`. The request is checked against `X-Telegram-Bot-Api-Secret-Token`, handled, and answered with `200`. Outgoing Telegram calls are awaited so they finish before the function freezes.

## Build pipeline (`npm run vercel-build` → `scripts/vercel-build.js`)

| # | Step | Notes |
|---|------|-------|
| 0 | `npm install --include=dev` | Vercel install command (vercel.json). `--include=dev` keeps build tools even when `NODE_ENV=production`. npm workspaces put everything into the root `node_modules`. |
| 1 | `prisma generate` | binaryTargets include `rhel-openssl-3.0.x` (Vercel runtime). |
| 2 | `nest build` | → `backend/dist` |
| 3 | `prisma migrate deploy` | Only when `DATABASE_URL` is set. Uses `DIRECT_URL`, which falls back to `DATABASE_URL`. Set `SKIP_MIGRATIONS=true` to disable. |
| 4 | `node dist/seed.js` | Idempotent. Creates default settings and the admin from `ADMIN_USERNAME`/`ADMIN_PASSWORD`. |
| 5 | `vite build` | → `frontend/dist` (Vercel `outputDirectory`) |
| 6 | copy admin | `backend/public/admin` → `frontend/dist/admin` |

Vercel then bundles `api/index.ts`. `includeFiles` makes sure `backend/dist/**` and the Prisma engine in `node_modules/.prisma/client/**` are included.

## Routing (vercel.json)

| Path | Target |
|------|--------|
| `/api/*` | serverless function (original URL preserved → Nest router) |
| `/webhook` | serverless function |
| `/admin` | redirect → `/admin/index.html` |
| `/admin/*.html` | static admin panel |
| everything else | static file if it exists, otherwise `/index.html` (SPA) |

## Environment variables

See `.env.example` for a description of each variable. Required: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `APP_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. Recommended: `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `NODE_ENV=production`.
All of them are read only on the server. The frontend bundle contains no secrets.

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | none (shows DB/migration status and which env vars are set, never their values) |
| POST | `/api/auth/init` | Telegram `initData` (HMAC-SHA256 verified, max 24 h old) |
| POST | `/api/auth/refresh` | user JWT |
| GET | `/api/users/me`, `/api/users/me/transactions?page&limit`, `/api/users/me/referrals` | user JWT |
| GET | `/api/wallet/me` | user JWT |
| GET | `/api/settings/withdrawal-methods` | none |
| GET | `/api/referrals/me/stats`, `/api/referrals/me/list` | user JWT |
| POST | `/api/withdrawals` · GET `/api/withdrawals/my` | user JWT |
| POST | `/webhook` (alias `/api/telegram/webhook`) | `X-Telegram-Bot-Api-Secret-Token` |
| POST | `/api/admin/login` | username + password (bcrypt) |
| GET | `/api/admin/me`, `stats`, `users`, `users/:id`, `transactions`, `withdrawals`, `settings`, `audit-logs` | admin JWT |
| POST | `/api/admin/users/:id/block`, `/api/admin/users/:id/unblock` | admin JWT |
| PATCH | `/api/admin/withdrawals/:id` `{status, adminNote}` | admin JWT |
| PUT | `/api/admin/settings` `{settings: {KEY: value}}` | admin JWT |

Rate limit: 20 requests per 60 s per IP (per function instance). Withdrawals and admin login are limited to 5 per 60 s. The webhook is exempt.

## Money and consistency rules

- Every amount is `Decimal(10,2)` in PostgreSQL and `Prisma.Decimal` in code. JS floats are never used for money. The API returns decimal strings.
- **Registration**: one DB transaction creates the user and wallet, credits the $5 bonus (`updateMany where registrationBonus = 0`, so it's idempotent) and writes a `REGISTRATION_BONUS` transaction. If the referral code is valid, it also creates the `Referral` (`inviteeId` is unique, so each user can be referred only once), credits $0.25 to the inviter and writes a `REFERRAL_REWARD` transaction. Self-referral and blocked inviters are ignored. A concurrent duplicate registration hits the unique `telegramId` and gets the existing user back.
- Users can register either via bot `/start <CODE>` (referral link `https://t.me/<bot>?start=<CODE>`) or by opening the Mini App (`start_param` / `?ref=`).
- **Withdrawal**: one DB transaction runs a conditional `balance >= amount` decrement, adds to `pendingWithdraw`, and creates the `Withdrawal` and a `WITHDRAWAL` (PENDING) transaction.
- **Status changes** use an optimistic lock on the current status. `PAID`: pending → totalWithdrawn, and the transaction becomes COMPLETED. `REJECTED`: pending → balance, the original transaction becomes REVERSED, and a `WITHDRAWAL_REVERSAL` transaction is written. `PAID` and `REJECTED` are final. Every admin action writes an `AdminAuditLog` entry.

## Webhook management

```bash
npm run set-webhook     # setWebhook (+secret), setMyCommands, menu button → Mini App
npm run webhook-info    # getWebhookInfo
APP_URL=https://your-app.vercel.app npm run check   # smoke-test a deployment
```

## Database operations

- New migration (local): edit `backend/prisma/schema.prisma`, run `cd backend && npx prisma migrate dev --name <change>`, then commit the new folder in `prisma/migrations`. The next Vercel deploy applies it.
- Neon free tier suspends idle compute. The first request after a pause takes about 1 s longer.
- With Supabase's transaction pooler (port 6543), `?pgbouncer=true` is required in `DATABASE_URL`.

## Optional: Docker / VPS

`docker-compose.yml` runs PostgreSQL, the API (standalone Nest server on port 3001, which also serves `/admin`) and the frontend (nginx on port 8080, which proxies `/api` and `/webhook`). Vercel doesn't need any of this.
