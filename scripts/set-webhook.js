#!/usr/bin/env node
/**
 * Registers the Telegram webhook, bot commands and the menu button.
 *   npm run set-webhook     -> setWebhook + setMyCommands + menu button
 *   npm run webhook-info    -> show current webhook status
 * Reads TELEGRAM_BOT_TOKEN, APP_URL and TELEGRAM_WEBHOOK_SECRET from the environment or from a .env file
 * in the project root (or backend/.env). The token is never printed.
 */
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv(path.join(__dirname, '..', '.env'));
loadEnv(path.join(__dirname, '..', 'backend', '.env'));

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = (process.env.APP_URL || process.env.MINI_APP_URL || '').replace(/\/+$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!token) {
  console.error('✖ TELEGRAM_BOT_TOKEN is not set. Put it in a .env file next to package.json or export it.');
  process.exit(1);
}

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.description}`);
  return data.result;
}

(async () => {
  const me = await tg('getMe');
  console.log(`✔ Bot token valid: @${me.username}`);

  if (process.argv.includes('--info')) {
    const info = await tg('getWebhookInfo');
    console.log(JSON.stringify({ ...info, url: info.url || '(not set)' }, null, 2));
    return;
  }

  if (!/^https:\/\//.test(appUrl)) {
    console.error('✖ APP_URL must be your public https URL, e.g. https://rocket-money.vercel.app');
    process.exit(1);
  }

  const url = `${appUrl}/webhook`;
  await tg('setWebhook', {
    url,
    allowed_updates: ['message'],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {}),
  });
  console.log(`✔ Webhook set to ${url}${secret ? ' (with secret token)' : ''}`);

  await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'Open Rocket Money' },
      { command: 'balance', description: 'Check your balance' },
      { command: 'referral', description: 'Get your referral link' },
      { command: 'help', description: 'How it works' },
      { command: 'support', description: 'Contact support' },
    ],
  });
  console.log('✔ Bot commands registered');

  await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Open App', web_app: { url: appUrl } } });
  console.log('✔ Menu button now opens the Mini App');

  const info = await tg('getWebhookInfo');
  console.log(`ℹ Pending updates: ${info.pending_update_count}${info.last_error_message ? ` · Last error: ${info.last_error_message}` : ''}`);
  const configured = (process.env.TELEGRAM_BOT_USERNAME || '').replace('@', '');
  console.log('\nNext steps:');
  console.log(`  1. Open @${me.username} in Telegram and send /start`);
  console.log('  2. Tap "Open App" — the Mini App should show a $5.00 balance');
  console.log(`  3. Admin panel: ${appUrl}/admin/`);
  if (configured && configured.toLowerCase() !== String(me.username).toLowerCase()) {
    console.warn(`⚠ TELEGRAM_BOT_USERNAME (${configured}) does not match the bot (@${me.username}). Referral links would be wrong.`);
  }
})().catch(err => {
  console.error('✖', err.message);
  process.exit(1);
});
