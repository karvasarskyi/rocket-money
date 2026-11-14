# 🚀 Rocket Money

## What is this

Rocket Money is a **Telegram bot plus a Telegram Mini App** for referrals and rewards. The live bot is **@RocketMX_bot**.

- Every new user gets a **$5.00 welcome bonus**, once per user.
- Users earn **$0.25 for every friend** who joins with their personal link. Only direct invites count: there are no multi-level rewards, you can't refer yourself, and a friend can only be rewarded once.
- Users can request a withdrawal once they have **$25.00** or more. The money is reserved right away.
- An **admin panel** at `/admin` lets you manage users, process withdrawals, view transactions, change settings and read the audit log.

Everything runs on **Vercel**, with a free PostgreSQL database from **Neon**. You don't need your own server.

---

## Quick Deploy to Vercel

You need free accounts on **GitHub**, **Vercel** (sign in with GitHub) and **Neon**, plus a Telegram bot.

### Step 1: Put the code on GitHub
Push this repository to GitHub, or upload the unzipped `rocket-money` folder at https://github.com/new using **"uploading an existing file"**. `package.json` and `vercel.json` must be at the **top level** of the repository.

### Step 2: Create the Telegram bot
1. In Telegram, open **@BotFather** and send `/newbot`. To keep the existing bot, send `/mybots` and choose **@RocketMX_bot** instead.
2. Copy the **token**, which looks like `1234567890:AAH...`. This is your `TELEGRAM_BOT_TOKEN`. **Never share it.**
3. Note the bot username **without the @**, for example `RocketMX_bot`.

### Step 3: Create the database (Neon)
Follow **[NEON_SETUP.md](NEON_SETUP.md)**. You will end up with two connection strings:
- **`DATABASE_URL`**: the *pooled* string. Its host contains `-pooler`.
- **`DIRECT_URL`**: the *direct* string. Its host has no `-pooler`.

Both should end with `?sslmode=require`.

### Step 4: Generate two random secrets
You need one for `JWT_SECRET` and one for `TELEGRAM_WEBHOOK_SECRET`. Either run `openssl rand -hex 32` twice, or generate two 32-character strings at https://www.random.org/strings/.

### Step 5: Import into Vercel and add environment variables
1. Go to https://vercel.com/new and click **Import** next to your repository.
2. Leave **Framework Preset = Other** and **Root Directory = `./`**. `vercel.json` already contains the build settings.
3. Open **Environment Variables** and add:

| Name | Required | Example / where to get it |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon **pooled** string (`...-pooler...neon.tech/neondb?sslmode=require`) |
| `DIRECT_URL` | ✅ | Neon **direct** string (same, without `-pooler`) |
| `TELEGRAM_BOT_TOKEN` | ✅ | Token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | ✅ | `RocketMX_bot` (without `@`) |
| `TELEGRAM_WEBHOOK_SECRET` | ✅ recommended | Random string #2 from Step 4 |
| `JWT_SECRET` | ✅ | Random string #1 from Step 4 (at least 32 characters) |
| `ADMIN_USERNAME` | ✅ | e.g. `admin` |
| `ADMIN_PASSWORD` | ✅ | Strong password, at least 8 characters |
| `APP_URL` | ✅ | Your Vercel domain without a trailing `/`, e.g. `https://rocket-money.vercel.app` (see Step 6) |
| `ADMIN_TELEGRAM_IDS` | optional | Your numeric Telegram ID (from @userinfobot) to get withdrawal and support notifications |
| `SUPPORT_CONTACT` | optional | Shown by `/support`, e.g. `@YourSupport` |
| `NODE_ENV` | optional | `production` |

`PORT` is only used when running locally and is ignored on Vercel. All variables are explained in [`.env.example`](.env.example).

4. Click **Deploy** and wait 1–3 minutes.

> **Migrations run automatically.** Every Vercel build runs `prisma migrate deploy` (creating or updating all tables) and then the seed, which adds the default settings and your first admin from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. You don't have to create tables by hand. To run them manually from your computer:
> `cd backend && DATABASE_URL="..." DIRECT_URL="..." npx prisma migrate deploy && npm run build && npm run db:seed`

### Step 6: Set `APP_URL` and redeploy
If you didn't know your domain in Step 5: copy the **Production** domain from **Project → Settings → Domains**. Add it as `APP_URL` and click **Deployments → ⋯ → Redeploy**.

### Step 7: Check health
Open `https://YOUR-DOMAIN/api/health`. You should see `"status":"ok"`, `"database":"ok"` and `"migrations":"ok"`. If it returns **503**, the response lists which variable is missing or wrong (`missingEnv`).

### Step 8: Connect the bot (set the webhook)
This has to be done **once after the first deploy**, and again whenever your domain changes.

**Option A, with Node.js 20+:** create a `.env` file in the project root containing `TELEGRAM_BOT_TOKEN=...`, `APP_URL=...` and `TELEGRAM_WEBHOOK_SECRET=...`, then run:
```bash
npm run set-webhook      # sets the webhook, registers the bot commands and the "Open App" menu button
npm run webhook-info     # optional: shows the current webhook status
```

**Option B, in a browser:** replace the three placeholders and open:
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR-DOMAIN>/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>&drop_pending_updates=true
```
You should see `"Webhook was set"`.

### Step 9: Enable the Mini App in BotFather
In @BotFather, go to `/mybots` → your bot → **Bot Settings → Configure Mini App → Enable Mini App**, and enter `https://YOUR-DOMAIN`.

### Step 10: Try it 🎉
Open the bot and press **Start**. You get $5 and a **🚀 Open Rocket Money** button. Share your link (`https://t.me/RocketMX_bot?start=YOURCODE`): each friend who joins earns you $0.25.

**Updating later:** push to GitHub. Vercel rebuilds and applies new migrations automatically.

Quick automated check from your computer: `APP_URL=https://YOUR-DOMAIN npm run check`.

---

## Local Development

You need **Node.js 20+** and PostgreSQL (local, or a free Neon branch).

```bash
npm install                        # installs backend + frontend (npm workspaces)
cp .env.example backend/.env       # then fill in the values
npm run migrate                    # create the tables
npm run seed                       # default settings + first admin
npm run dev:backend                # API on http://localhost:3001 (admin panel at /admin)
npm run dev:frontend               # Mini App on http://localhost:5173 (proxies /api to :3001)
```

When `NODE_ENV` is not `production`, opening the Mini App in a normal browser signs you in as a test user. In production, a valid Telegram signature is always required.

**All-in-one script (Linux):** `scripts/start-local.sh` starts PostgreSQL on port **5433**, auto-detecting version 18 or 17. Data lives in `/home/ubuntu/pg_data` and sockets in `/home/ubuntu/pgsockets`. The script creates `backend/.env` if it's missing, builds, migrates and seeds, then starts one Node process on port **3000** serving the API, the webhook, `/admin` and the Mini App. Flags: `--rebuild` rebuilds first; `--webhook` also registers the Telegram webhook.

---

## Admin Panel

Open `https://YOUR-DOMAIN/admin` and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

| Page | What you can do |
|---|---|
| **Dashboard** | Total users and referrals, user balances, pending and paid withdrawals, bonuses paid, recent admin activity |
| **Users** | Search, view details (wallet, referrals, transactions, withdrawals), block or unblock |
| **Withdrawals** | Filter by status and change the status: **Processing**, **Approve**, **Mark paid** or **Reject**. Rejecting returns the reserved money to the user's balance. *Paid* and *Rejected* are final. |
| **Transactions** | Every bonus, referral reward, withdrawal and reversal |
| **Settings** | Bonus, referral reward, minimum withdrawal, withdrawal methods, registration and referral on/off switches |

Withdrawal lifecycle: `PENDING → PROCESSING → APPROVED → PAID`, or `REJECTED` from any non-final state. Every admin action is written to the **audit log**.

**Forgot the password?** Set a new `ADMIN_PASSWORD` plus `ADMIN_RESET_PASSWORD=true`, redeploy, then set `ADMIN_RESET_PASSWORD` back to `false`.

---

## Bot Commands

| Command | What it does |
|---|---|
| `/start` | Registers you (once), credits the $5 bonus, applies a referral code from the link, and shows the **Open Rocket Money** Mini App button |
| `/balance` | Shows your balance, total earned, pending withdrawals and total withdrawn |
| `/referral` | Shows your referral link and how many friends you've invited |
| `/help` | Lists all commands |
| `/support` | Shows the support contact (`SUPPORT_CONTACT`), or forwards your request to the admins |

---

## Architecture

```
rocket-money/
├── api/index.ts            Vercel serverless entry: wraps the NestJS app
├── vercel.json             Build, rewrites (/api/*, /webhook → function; everything else → Mini App)
├── backend/                NestJS + Prisma (PostgreSQL)
│   ├── prisma/             schema.prisma + migrations
│   ├── public/admin/       Admin panel (static HTML + admin.js, no build step)
│   └── src/
│       ├── auth/           Telegram initData verification → JWT (POST /api/auth/telegram), admin JWT
│       ├── users/ wallet/  Registration ($5 bonus), balances
│       ├── referrals/      $0.25 single-level rewards
│       ├── withdrawals/    Requests ($25 min), reserve / release / reverse funds
│       ├── admin/          /api/admin/* endpoints + audit log
│       ├── telegram/       Webhook (POST /webhook) and bot commands
│       └── settings/       Configurable amounts and withdrawal methods
├── frontend/               React + Vite + Tailwind + Framer Motion Mini App (Home, Referrals, Wallet, Withdraw, Profile)
└── scripts/                vercel-build, set-webhook, check-deployment, start-local
```

- **Auth:** the Mini App sends `Telegram.WebApp.initData` to `POST /api/auth/telegram`. The backend verifies the HMAC signature with the bot token and returns a JWT. Every later request carries `Authorization: Bearer <jwt>` plus the `X-Telegram-Init-Data` header.
- **Money:** all amounts are Prisma `Decimal`, and every balance change happens inside a database `$transaction`.
- **Health:** `GET /api/health` reports the database, migration and config status.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full technical reference.
