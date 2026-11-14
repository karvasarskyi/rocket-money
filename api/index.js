// Vercel serverless entry point.
// Every /api/*, /admin/api/* and /webhook request is rewritten here (see vercel.json)
// and handled by the compiled NestJS application (backend/dist). The Nest app is
// bootstrapped once per function instance and reused across invocations.
const { getHandler } = require('../backend/dist/serverless');

module.exports = async function handler(req, res) {
  try {
    const app = await getHandler();
    return app(req, res);
  } catch (err) {
    console.error('[api] Failed to bootstrap application:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ statusCode: 500, message: 'Server failed to start. Check Vercel function logs and environment variables.' }));
  }
};
