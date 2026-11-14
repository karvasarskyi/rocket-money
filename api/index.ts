// Vercel serverless function. vercel.json rewrites /api/* and /webhook to this file;
// the original URL is preserved, so the NestJS router (compiled into backend/dist) handles routing.
// The Nest app is bootstrapped once per function instance and reused across invocations.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getHandler } = require('../backend/dist/serverless');

export default async function handler(req: any, res: any) {
  try {
    const app = await getHandler();
    return app(req, res);
  } catch (err) {
    console.error('[api] Failed to bootstrap application:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        statusCode: 500,
        message: 'Server failed to start. Check the Vercel function logs and your environment variables (DATABASE_URL, JWT_SECRET).',
      }),
    );
  }
}
