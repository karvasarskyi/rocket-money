import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthedRequest } from '../common/types';
import { misconfigured } from '../common/config';
import { DEV_MOCK_USER, isDevBypassAllowed, verifyInitData } from './telegram-auth.util';

/** Validates Telegram WebApp initData sent in the request body (`initData`) or `x-telegram-init-data` header. */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const initData: string = (req.body && req.body.initData) || (req.headers['x-telegram-init-data'] as string) || '';

    if (isDevBypassAllowed(initData)) {
      req.telegramUser = DEV_MOCK_USER;
      req.telegramStartParam = req.body?.startParam || undefined;
      return true;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!botToken) throw misconfigured('TELEGRAM_BOT_TOKEN');
    const verified = verifyInitData(initData, botToken);
    if (!verified) throw new UnauthorizedException('Invalid Telegram authentication data. Please open the app from Telegram.');
    req.telegramUser = verified.user;
    req.telegramStartParam = verified.startParam || req.body?.startParam || undefined;
    return true;
  }
}
