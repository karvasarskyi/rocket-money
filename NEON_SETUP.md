# Setting Up Neon Database for Rocket Money

## 1. Create Neon Account & Database
1. Go to https://neon.tech and sign up (free tier is enough to start)
2. Click "New Project"
3. Name it "rocket-money"
4. Select a region close to your users
5. Click "Create Project"

## 2. Get Connection Strings
After creating the project, you'll see the connection details.
1. Click "Connection Details"
2. Select "Prisma" from the connection type dropdown
3. You'll see two strings:
   - DATABASE_URL (for connection pooling via pgBouncer)
   - DIRECT_URL (direct connection for migrations)
4. Copy BOTH strings — you need them both

## 3. Run the Database Migration on Neon
Option A — Using Neon SQL Console (easiest):
1. In Neon dashboard, click "SQL Editor"
2. Open the file `backend/prisma/migrations/20240101000000_init/migration.sql` from the GitHub repo
3. Copy the entire contents
4. Paste into the Neon SQL Editor
5. Click "Run"
6. You should see "Success" for each statement

> Important: you usually don't need to do this step by hand. Every Vercel build runs
> `prisma migrate deploy` and then the seed (default settings + admin account) automatically,
> as long as DATABASE_URL and DIRECT_URL are set in Vercel.
>
> If you DO run Option A, Prisma won't know the migration was applied, and the next Vercel build
> will fail with "relation already exists". To fix that, run this once from your machine:
> `cd backend && DATABASE_URL="..." DIRECT_URL="..." npx prisma migrate resolve --applied 20240101000000_init`
> Don't set `SKIP_MIGRATIONS=true` to work around it, because that also skips creating the admin account.

Option B — Using CLI:
1. Install Neon CLI: `npm install -g neonctl`
2. Run: `cd backend && DATABASE_URL="your_neon_url" DIRECT_URL="your_neon_direct_url" npx prisma migrate deploy`

(Option B was tested against a local PostgreSQL. It created all 8 tables: users, wallets, referrals,
transactions, withdrawals, admins, admin_audit_logs, system_settings.)

## 4. Add Environment Variables to Vercel
In Vercel project settings → Environment Variables, add:
- DATABASE_URL = (from Neon, the pooler URL)
- DIRECT_URL = (from Neon, the direct URL)
- TELEGRAM_BOT_TOKEN = your bot token
- TELEGRAM_BOT_USERNAME = RocketMX_bot (no @)
- APP_URL = https://your-vercel-app.vercel.app
- MINI_APP_URL = https://your-vercel-app.vercel.app
- FRONTEND_URL = https://your-vercel-app.vercel.app
- TELEGRAM_WEBHOOK_SECRET = (any random 32-char string, e.g. run: openssl rand -hex 16)
- ADMIN_USERNAME = admin
- ADMIN_PASSWORD = (choose a strong password)
- JWT_SECRET = (random string, e.g. run: openssl rand -hex 32)
- NODE_ENV = production

> `APP_URL` is the one the backend actually uses. `MINI_APP_URL` and `FRONTEND_URL` are optional;
> setting them to the same value does no harm.

## 5. Register Telegram Webhook
After Vercel deploys successfully, register your bot webhook:

Option A — Using the included script:
```bash
# From your local machine, with the project cloned:
cp .env.example .env
# Edit .env with your real values, then:
node scripts/set-webhook.js
```
The script also registers the bot commands and sets the menu button to open the Mini App.
To check the current webhook status, run `node scripts/set-webhook.js --info`.

Option B — Manual (replace values):
```
https://api.telegram.org/bot{YOUR_TOKEN}/setWebhook?url=https://your-app.vercel.app/webhook&secret_token={YOUR_WEBHOOK_SECRET}
```
Open that URL in your browser. You should see: {"ok":true,"result":true}

## 6. Configure BotFather
Open @BotFather on Telegram:
1. /setmenubutton — select your bot — enter URL: https://your-app.vercel.app — set button text: "🚀 Open App"
2. /setdomain — select your bot — enter: your-app.vercel.app
3. /setdescription — set a description for your bot

## 7. Verify Everything Works
1. Open your bot in Telegram
2. Send /start — you should see the welcome message with an "Open App" button
3. Click "Open App" — the Mini App should open
4. You should see a $5.00 balance credited automatically
5. Go to Admin Panel: https://your-app.vercel.app/admin/
   - Login with ADMIN_USERNAME and ADMIN_PASSWORD
   - You should see 1 user in the dashboard
6. Health check: open https://your-app.vercel.app/api/health. It should show `"database":"ok"` and `"migrations":"ok"`
