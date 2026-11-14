import './common/bigint';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

/** Shared configuration for both the standalone server and the Vercel serverless handler. */
export function configureApp(app: INestApplication) {
  const http = app.getHttpAdapter().getInstance();
  if (http && typeof http.set === 'function') http.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true, credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));
}
