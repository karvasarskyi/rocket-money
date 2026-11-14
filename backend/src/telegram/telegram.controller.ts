import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { TelegramService, TgUpdate } from './telegram.service';

@Controller()
@SkipThrottle()
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post(['webhook', 'api/telegram/webhook'])
  @HttpCode(200)
  async webhook(@Body() update: TgUpdate, @Headers('x-telegram-bot-api-secret-token') secret?: string) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected) {
      const a = Buffer.from(secret || '');
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new ForbiddenException('Invalid webhook secret');
    }
    // Always answer 200 so Telegram does not retry endlessly; errors are logged inside the service.
    if (update && typeof update.update_id === 'number') await this.telegram.handleUpdate(update);
    return { ok: true };
  }
}
