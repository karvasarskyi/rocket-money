import './common/bigint';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/** Standalone server (local development / Docker). On Vercel, serverless.ts is used instead. */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  const adminDir = join(__dirname, '..', 'public', 'admin');
  if (existsSync(adminDir)) app.useStaticAssets(adminDir, { prefix: '/admin', index: 'index.html' });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Rocket Money API listening on port ${port}`);
}

bootstrap();
