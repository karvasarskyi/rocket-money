#!/usr/bin/env node
/** Checks a deployed instance: `APP_URL=https://your-app.vercel.app npm run check` */
const appUrl = (process.env.APP_URL || process.argv[2] || '').replace(/\/+$/, '');
if (!appUrl) {
  console.error('Usage: APP_URL=https://your-app.vercel.app npm run check');
  process.exit(1);
}

(async () => {
  let failed = 0;
  const check = async (name, path, test, init) => {
    try {
      const res = await fetch(appUrl + path, init);
      const text = await res.text();
      let ok = false;
      try {
        ok = test(res, text);
      } catch {
        ok = false;
      }
      console.log(`${ok ? '✔' : '✖'} ${name} (${res.status})`);
      if (!ok) {
        failed++;
        console.log('   ' + text.slice(0, 300));
      }
    } catch (e) {
      failed++;
      console.log(`✖ ${name}: ${e.message}`);
    }
  };
  await check('Mini App page', '/', (r, t) => r.ok && t.includes('id="root"'));
  await check('Admin panel', '/admin/login.html', (r, t) => r.ok && t.includes('Admin'));
  await check('API health + database + migrations', '/api/health', (r, t) => r.ok && JSON.parse(t).status === 'ok');
  await check('Public settings endpoint', '/api/settings/withdrawal-methods', (r, t) => r.ok && JSON.parse(t).methods.length > 0);
  await check('Auth rejects unsigned data', '/api/auth/init', r => r.status === 401, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: 'user=%7B%7D&hash=00' }),
  });
  await check('Webhook endpoint reachable', '/webhook', r => r.status === 200 || r.status === 403, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
