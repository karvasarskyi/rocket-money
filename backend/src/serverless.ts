import './common/bigint';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

type Handler = (req: any, res: any) => void;
let cached: Promise<Handler> | null = null;

async function create(): Promise<Handler> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { logger: ['error', 'warn', 'log'] });
  configureApp(app);
  await app.init();
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
