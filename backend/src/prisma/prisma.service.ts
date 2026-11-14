import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Connect eagerly when possible, but never fail bootstrap: Prisma reconnects lazily on the next query,
    // and /api/health + the global exception filter report database problems as JSON instead of a crash.
    try {
      await this.$connect();
    } catch (err) {
      console.error('[prisma] Initial connection failed:', (err as Error).message.split('\n').filter(Boolean)[0]);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
