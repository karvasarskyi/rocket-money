// Vercel serverless function. vercel.json rewrites /api/* and /webhook to this file;
// the original URL is preserved, so the NestJS router (compiled into backend/dist) handles routing.
// The Nest app is bootstrapped once per function instance and reused across invocations.
// Every failure path answers JSON – this function must never crash (FUNCTION_INVOCATION_FAILED).

const REQUIRED_ENV = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_USERNAME',
  'JWT_SECRET',
  'APP_URL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
];

/** Names of missing variables only – never values. */
function missingEnv(): string[] {
  return REQUIRED_ENV.filter(k => {
    if (k === 'APP_URL') return !process.env.APP_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (k === 'JWT_SECRET') return (process.env.JWT_SECRET || '').length < 16;
    return !(process.env[k] || '').trim();
  });
}

function sendJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  try {
    // Required lazily so even a module-load error is reported as JSON instead of crashing the function.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getHandler } = require('../backend/dist/serverless');
    const app = await getHandler();
    return app(req, res);
  } catch (err) {
    const reason = ((err as Error)?.message || String(err)).split('\n').filter(Boolean).pop()?.trim().slice(0, 300);
    console.error('[api] Failed to bootstrap application:', err);
    const missing = missingEnv();
    const message = missing.length
      ? `Server is not configured. Missing environment variables: ${missing.join(', ')}. Add them in Vercel → Settings → Environment Variables and redeploy.`
      : `Server failed to start: ${reason}`;
    const path = String(req.url || '').split('?')[0];
    if (path === '/api/health') {
      return sendJson(res, 503, { status: 'down', bootstrap: 'failed', error: reason, missingEnv: missing, time: new Date().toISOString() });
    }
    return sendJson(res, 503, { statusCode: 503, error: 'Service Unavailable', message });
  }
}
