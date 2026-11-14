import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { getMissingEnv } from './config';

/**
 * Turns infrastructure errors (database unreachable / not configured, migrations not applied) into a clear
 * 503 JSON response instead of an opaque 500. Business errors (HttpException) are not affected.
 */
@Catch(Prisma.PrismaClientInitializationError, Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientRustPanicError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(err: Error & { code?: string }, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.SERVICE_UNAVAILABLE;
    let message: string;

    if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientRustPanicError) {
      message = getMissingEnv(['DATABASE_URL']).length
        ? 'Server is not configured: DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables and redeploy.'
        : 'Database is unreachable. Check DATABASE_URL (Neon pooled connection string) and that the database is running.';
    } else if (err.code === 'P2021' || err.code === 'P2022') {
      message = 'Database tables are missing: migrations have not been applied. Redeploy with DATABASE_URL and DIRECT_URL set, or run `npx prisma migrate deploy`.';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }
    console.error(`[db] ${err.constructor.name}${err.code ? ' ' + err.code : ''}: ${err.message.split('\n').filter(Boolean).pop()}`);
    res.status(status).json({ statusCode: status, message, error: status === 503 ? 'Service Unavailable' : 'Internal Server Error' });
  }
}
