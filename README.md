# 🚀 Rocket Money

Rocket Money is a Telegram bot plus a Mini App for referrals and rewards.

- New users automatically get a **$5.00 welcome bonus** (once per user).
- Users earn **$0.25 for every friend** who joins with their link. Only direct invites count.
- Users can request a withdrawal once they have **$25.00** or more.
- There is an **admin panel** at `/admin` for users, withdrawals, transactions and settings.

Everything runs on **Vercel**, with a free PostgreSQL database from **Neon** (or Supabase). You don't need a server, Docker, or anything installed on your computer.

---

## 📋 What you need

| Thing | Where | Cost |
|---|---|---|
| GitHub account | https://github.com | Free |
| Vercel account (sign in with GitHub) | https://vercel.com | Free (Hobby) |
| Neon account | https://neon.tech | Free |
| Telegram bot | @BotFather in Telegram | Free |

> 🟢 = do this **once**. 🔁 = do this **every time you update** the app.

---

## Part A: One-time setup

### 🟢 Step 1: Download the project
1. Download `rocket-money.zip` and unzip it. You will get a folder called `rocket-money`.

### 🟢 Step 2: Put it on GitHub
1. Open https://github.com/new.
2. For **Repository name**, type `rocket-money`. Choose **Private** and click **Create repository**.
3. On the next page, click **"uploading an existing file"**.
4. Open the `rocket-money` folder on your computer. Select **everything inside it** (including the `api`, `backend`, `frontend` and `scripts` folders and `package.json`). Drag it all into the browser.
   - Make sure `package.json` and `vercel.json` end up at the **top level** of the repository, not inside a `rocket-money/` subfolder.
   - If hidden files like `.gitignore` and `.env.example` don't upload, that's fine. They aren't needed for deployment.
5. Click **Commit changes**.

### 🟢 Step 3: Create your Telegram bot
1. In Telegram, open **@BotFather** and send `/newbot`.
2. Choose a display name (for example `Rocket Money`) and a username ending in `bot` (for example `RocketMoneyCashBot`).
3. BotFather replies with a **token** like `1234567890:AAH...`. Save it. This is your `TELEGRAM_BOT_TOKEN`. **Never share it.**
4. Save the username **without the @**. This is your `TELEGRAM_BOT_USERNAME`.
5. Optional: open **@userinfobot** to get your own numeric Telegram ID. Use it for `ADMIN_TELEGRAM_IDS` so the bot notifies you about withdrawal requests.

### 🟢 Step 4: Create the database (Neon)
1. Go to https://console.neon.tech and sign up.
2. Click **New Project**. Name it `rocket-money`, pick the region closest to your users, and click **Create**.
3. On the project dashboard, click **Connect**.
4. Make sure **Connection pooling** is **ON**. Copy the connection string. This is your **`DATABASE_URL`**. Its host contains `-pooler`.
5. Turn **Connection pooling OFF** and copy the string again. This is your **`DIRECT_URL`**. Its host has no `-pooler`.
6. Both strings should end with `?sslmode=require`.

<details>
<summary>Using Supabase instead of Neon?</summary>

1. Create a project at https://supabase.com and save the database password.
2. Click **Connect** at the top of the dashboard.
3. Copy the **Transaction pooler** string (port **6543**) and add `?pgbouncer=true` at the end. Use it as **`DATABASE_URL`**.
4. Copy the **Session pooler** string (port **5432**). Use it as **`DIRECT_URL`**.
5. Replace `[YOUR-PASSWORD]` in both strings with your database password.
</details>

You don't need to create any tables. They are created automatically when Vercel builds the project.

### 🟢 Step 5: Make two random secrets
You need two long random strings: one for `JWT_SECRET` and one for `TELEGRAM_WEBHOOK_SECRET`.
- Easiest: go to https://www.random.org/strings/. Generate 2 strings of 32 characters (digits plus upper and lower case letters) and copy them.
- Or, if you have a terminal: run `openssl rand -hex 32` twice.

### 🟢 Step 6: Import the project into Vercel
1. Go to https://vercel.com/new and click **Import** next to your `rocket-money` repository. If you don't see it, click **Adjust GitHub App Permissions** and give Vercel access.
2. Leave **Framework Preset = Other** and **Root Directory = `./`**. Don't change the build settings, because `vercel.json` already sets them.
3. Open **Environment Variables** and add these:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token from Step 3 |
| `TELEGRAM_BOT_USERNAME` | bot username **without @** |
| `TELEGRAM_WEBHOOK_SECRET` | random string #2 from Step 5 |
| `DATABASE_URL` | pooled string from Step 4 |
| `DIRECT_URL` | direct string from Step 4 |
| `JWT_SECRET` | random string #1 from Step 5 |
| `ADMIN_USERNAME` | e.g. `admin` |
| `ADMIN_PASSWORD` | a strong password, at least 8 characters |
| `ADMIN_TELEGRAM_IDS` | your Telegram ID (optional) |
| `NODE_ENV` | `production` |
| `APP_URL` | leave it out for now; you add it in Step 7 |

4. Click **Deploy** and wait 1–3 minutes. The build automatically:
   - creates all database tables (`prisma migrate deploy`),
   - creates default settings and your **first administrator** from `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

### 🟢 Step 7: Add your site URL
1. When the deployment finishes, Vercel shows your domain, for example `https://rocket-money-abc.vercel.app`. Use the main **Production** domain from **Project → Settings → Domains**, not a long preview link.
2. Go to **Settings → Environment Variables** and add `APP_URL` = `https://rocket-money-abc.vercel.app`. Leave off the trailing `/`.
3. Go to **Deployments**, click **⋯** on the latest deployment, then **Redeploy**.

### 🟢 Step 8: Check that everything works
Open `https://YOUR-DOMAIN/api/health` in your browser. You should see:
```json
{"status":"ok","database":"ok","migrations":"ok", "config": { ... all true ... }}
```
If `database` shows an error, re-check `DATABASE_URL`. If any `config` value is `false` or `null`, that environment variable is missing.

### 🟢 Step 9: Connect the Telegram bot (webhook)
Pick **one** of these options:

**Option 1, in the browser (no tools needed):** paste this into your browser's address bar after replacing the 3 placeholders, then press Enter:
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR-DOMAIN>/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>&drop_pending_updates=true
```
You should see `{"ok":true,"result":true,"description":"Webhook was set"}`.

**Option 2, with Node.js on your computer:** inside the project folder, create a file named `.env` containing `TELEGRAM_BOT_TOKEN=...`, `APP_URL=...` and `TELEGRAM_WEBHOOK_SECRET=...`. Then run:
```bash
npm run set-webhook
```
This sets the webhook, registers the bot commands (`/start`, `/balance`, `/referral`, `/help`, `/support`) and turns the chat's menu button into **Open App**.

### 🟢 Step 10: Set the Mini App in BotFather
1. In @BotFather, send `/mybots`, choose your bot, then **Bot Settings → Configure Mini App → Enable Mini App**. Enter your URL: `https://YOUR-DOMAIN`.
2. Optional: **Bot Settings → Menu Button**. Set the URL to `https://YOUR-DOMAIN` and the title to `Open App`. Option 2 in Step 9 already does this.

### 🟢 Step 11: Open the Mini App 🎉
1. Open your bot in Telegram and press **Start**.
2. The bot welcomes you, credits the **$5 bonus**, and shows an **🚀 Open Rocket Money** button. Tap it.
3. Your referral link looks like `https://t.me/YourBot?start=ABCD2345`. When a friend opens it and presses Start, they get $5 and you get $0.25.

### 🟢 Step 12: Open the admin panel
Go to `https://YOUR-DOMAIN/admin` and log in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. There you can:
- see dashboard statistics,
- search users, view their details, and block or unblock them,
- process withdrawals: **Processing → Approve → Mark paid**, or **Reject**. Rejecting returns the money to the user,
- view all transactions,
- change the bonus amount, reward amount, minimum withdrawal, withdrawal methods, and turn registration or referrals on and off.

Forgot the admin password? Set `ADMIN_PASSWORD` to a new value and `ADMIN_RESET_PASSWORD=true`, then redeploy. After that, set `ADMIN_RESET_PASSWORD` back to `false`.

---

## Part B: 🔁 Every future update
1. Change the files and upload them to GitHub. On GitHub, use **Add file → Upload files** in the same repository, or `git push`.
2. **That's all.** Vercel rebuilds and deploys automatically, and applies any new database migrations.

You **don't** need to repeat the webhook, BotFather or database steps unless your domain changes. If the domain changes, update `APP_URL`, redeploy, and redo Steps 9 and 10.

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| Bot doesn't answer | Open `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`. `url` must be `https://YOUR-DOMAIN/webhook`. If `last_error_message` says `403`, the `secret_token` doesn't match `TELEGRAM_WEBHOOK_SECRET`. |
| No "Open Rocket Money" button in the bot | `APP_URL` is missing. Add it and redeploy. |
| Mini App says "Please open Rocket Money from the Telegram bot" | You opened the site in a normal browser. Open it from Telegram instead. Otherwise `TELEGRAM_BOT_TOKEN` is wrong. |
| `/api/health` shows `migrations: missing` | `DIRECT_URL` is wrong. Fix it and redeploy. The build log shows `prisma migrate deploy` output. |
| Build fails at `prisma migrate deploy` | Check that `DIRECT_URL` is the **direct**, non-pooled string and that the password is correct. |
| Referral links show the wrong bot | `TELEGRAM_BOT_USERNAME` must match the bot exactly, without `@`. |
| Can't log in to /admin | Check `ADMIN_USERNAME` and `ADMIN_PASSWORD`. To force a new password, use `ADMIN_RESET_PASSWORD=true`. |

Quick automated check from your computer (needs Node.js 20+): `APP_URL=https://YOUR-DOMAIN npm run check`.

---

## 💻 Local development (optional)
You need Node.js 20+ and a PostgreSQL connection string. A free Neon branch works.
```bash
npm install                       # installs backend + frontend (npm workspaces)
cp .env.example backend/.env      # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET...
npm run migrate                   # create tables
npm run seed                      # default settings + admin
npm run dev:backend               # API on http://localhost:3001 (admin at /admin)
npm run dev:frontend              # Mini App on http://localhost:5173 (proxies /api)
```
Outside production (`NODE_ENV` is not `production`), opening the Mini App in a normal browser signs you in as a test user (`TestUser`, id 12345). In production, Telegram's signature is always required.

See **DEPLOYMENT.md** for the technical reference.
