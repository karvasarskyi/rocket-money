import './common/bigint';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/** Standalone server (local development / Docker). On Vercel, serverless.ts is used instead. */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  const adminDir = join(__dirname, '..', 'public', 'admin');
  if (existsSync(adminDir)) app.useStaticAssets(adminDir, { prefix: '/admin', index: 'index.html' });

  // Optionally serve the built Mini App (single-process hosting without Vercel/nginx).
  const frontendDir = process.env.FRONTEND_DIST || join(__dirname, '..', '..', 'frontend', 'dist');
  const indexHtml = join(frontendDir, 'index.html');
  if (existsSync(indexHtml)) {
    const isBackendPath = (p: string) => p.startsWith('/api') || p.startsWith('/admin') || p.startsWith('/webhook');
    // Telegram Web embeds the Mini App in an iframe, so the frame restriction is kept only for the admin panel.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!req.path.startsWith('/admin')) res.removeHeader('X-Frame-Options');
      next();
    });
    app.useStaticAssets(frontendDir, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || isBackendPath(req.path) || /\.[a-z0-9]+$/i.test(req.path)) return next();
      res.sendFile(indexHtml);
    });
    console.log(`Serving Mini App from ${frontendDir}`);
  }
  app.enableShutdownHooks();
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Rocket Money API listening on port ${port}`);
}

bootstrap();
