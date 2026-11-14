import './common/bigint';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { PrismaService } from './prisma/prisma.service';
import { seedDatabaseSafely } from './common/seed-database';
import { envReport } from './health.controller';

type Handler = (req: any, res: any) => void;
let cached: Promise<Handler> | null = null;

async function create(): Promise<Handler> {
  const server = express();
  // abortOnError: false – by default Nest calls process.exit(1) when bootstrap fails, which kills the
  // serverless function (Vercel: FUNCTION_INVOCATION_FAILED) before api/index.ts can return a JSON error.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
    abortOnError: false,
  });
  configureApp(app);
  await app.init();
  await seedDatabaseSafely(app.get(PrismaService));
  return server as unknown as Handler;
}

/** Returns a cached Express handler so the Nest app is bootstrapped once per serverless instance. */
export function getHandler(): Promise<Handler> {
  if (!cached) {
    cached = create().catch(err => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export { envReport };
